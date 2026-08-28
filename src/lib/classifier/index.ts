import type { Category, ExtractedData } from '@/types/email';
import {
  ACCOUNT_SENDERS,
  BULK_FOOTER,
  CONTENT_NOT_PROMO,
  NOISE_SENDERS,
  RULES,
  SOCIAL_SENDERS,
  type CategoryRules,
} from '@/lib/classifier/rules';
import {
  extractAmount,
  extractCarrier,
  extractDueDate,
  extractMerchant,
  extractRole,
  organizationFromSender,
  extractTracking,
  extractUrgency,
  normalize,
} from '@/lib/classifier/extractors';

export interface ClassifiableEmail {
  subject: string;
  senderName: string;
  senderEmail: string;
  body: string;
  dateReceived: string;
}

export interface ClassificationResult {
  category: Category;
  confidence: number;
  extractedData: ExtractedData;
  /** Puntaje por categoria; util para depurar y para las pruebas. */
  scores: Record<string, number>;
  /** Senales que dispararon la categoria ganadora. */
  matched: string[];
}

/** Un correo largo no aporta mas senal que sus primeros parrafos, y recortar acota el costo del regex. */
const BODY_SCAN_LIMIT = 4000;

function scoreCategory(
  rules: CategoryRules,
  subject: string,
  body: string,
  sender: string,
): { score: number; matched: string[]; subjectHits: number } {
  let score = 0;
  const matched: string[] = [];

  for (const signal of rules.domains) {
    if (signal.pattern.test(sender)) {
      score += signal.weight;
      matched.push(`from:${signal.label}`);
    }
  }

  let subjectHits = 0;
  for (const signal of rules.subject) {
    if (signal.pattern.test(subject)) {
      score += signal.weight;
      subjectHits += 1;
      matched.push(`subject:${signal.label}`);
    }
  }

  let bodyHits = 0;
  for (const signal of rules.body) {
    if (signal.pattern.test(body)) {
      // El cuerpo confirma, no decide: pesa la mitad que el asunto.
      score += signal.weight * 0.5;
      bodyHits += 1;
      matched.push(`body:${signal.label}`);
    }
  }

  // Asunto y cuerpo coincidiendo es mucho mas fiable que cualquiera por separado.
  if (subjectHits > 0 && bodyHits > 0) score += 2;

  return { score, matched, subjectHits };
}

/**
 * Clasifica un correo y extrae sus metadatos.
 *
 * Estrategia: puntaje por palabras clave ponderadas, con desempate por
 * `priority` (un correo que es a la vez factura y urgente se muestra como
 * urgente, porque es la accion que no puede esperar).
 */
export function classifyEmail(email: ClassifiableEmail): ClassificationResult {
  const subject = normalize(email.subject ?? '');
  const body = normalize((email.body ?? '').slice(0, BODY_SCAN_LIMIT));
  const sender = normalize(`${email.senderName ?? ''} ${email.senderEmail ?? ''}`);
  const fullText = `${email.subject ?? ''}\n${email.body ?? ''}`.slice(0, BODY_SCAN_LIMIT);

  const scores: Record<string, number> = {};
  const matchedByCategory: Record<string, string[]> = {};
  const subjectHitsByCategory: Record<string, number> = {};

  for (const rules of RULES) {
    const { score, matched, subjectHits } = scoreCategory(rules, subject, body, sender);
    scores[rules.category] = score;
    matchedByCategory[rules.category] = matched;
    subjectHitsByCategory[rules.category] = subjectHits;
  }

  // Un remitente automatico rara vez exige accion personal, asi que se baja el
  // sesgo hacia URGENT. Pero solo cuando la urgencia venia del dominio o del
  // cuerpo: si el asunto dice "alerta de seguridad", el correo es urgente
  // aunque llegue desde un `no-reply`, que es justo como llegan esas alertas.
  if (
    NOISE_SENDERS.test(email.senderEmail ?? '') &&
    scores.URGENT > 0 &&
    subjectHitsByCategory.URGENT === 0
  ) {
    scores.URGENT = Math.max(0, scores.URGENT - 3);
  }

  // Una notificacion de red social no es publicidad, por mucho que el cuerpo
  // arrastre el titular comercial de otra persona.
  if (SOCIAL_SENDERS.test(email.senderEmail ?? '')) {
    scores.PROMO = 0;
  }

  // Contenido o aviso operativo enviado por una marca: el remitente sugiere
  // publicidad, pero el asunto dice claramente que no lo es.
  if (scores.PROMO > 0 && CONTENT_NOT_PROMO.test(`${email.subject ?? ''} ${body.slice(0, 400)}`)) {
    scores.PROMO = 0;
  }

  const MIN_SCORE = 5;
  const ranked = RULES.map((r) => ({
    category: r.category,
    score: scores[r.category],
    priority: r.priority,
  })).sort((a, b) => (b.score !== a.score ? b.score - a.score : b.priority - a.priority));

  const winner = ranked[0];
  let category: Category = winner && winner.score >= MIN_SCORE ? winner.category : 'GENERAL';
  let rescued = false;

  /**
   * Rescate de boletines.
   *
   * Los boletines editoriales llegan con titulares de gancho ("eight tickers,
   * one bet") que no contienen ninguna palabra clave, asi que ninguna regla
   * los alcanza y caian todos en General. Lo unico que comparten es el pie de
   * baja, pero ese pie tambien lo llevan los catalogos.
   *
   * De ahi la definicion por descarte: correo en lote, sin ninguna senal de
   * ninguna categoria, que no viene de una red social ni de un buzon de
   * cuenta, y trae cuerpo suficiente para ser una lectura. Eso es un boletin.
   *
   * La condicion no es "no puntuo nada", sino "lo que mas puntuo fue Noticias
   * y se quedo corto". Estos boletines suelen rondar los 4 puntos —hablan de
   * mercados, traen pie de baja— sin llegar al umbral de 5; exigir cero
   * senales los dejaba fuera precisamente a ellos.
   */
  const mejorCandidatoEsBoletin = !winner || winner.score === 0 || winner.category === 'NEWS';

  if (
    category === 'GENERAL' &&
    mejorCandidatoEsBoletin &&
    BULK_FOOTER.test(body) &&
    body.length > 200 &&
    !SOCIAL_SENDERS.test(email.senderEmail ?? '') &&
    !ACCOUNT_SENDERS.test(email.senderEmail ?? '') &&
    !CONTENT_NOT_PROMO.test(`${email.subject ?? ''} ${body.slice(0, 400)}`)
  ) {
    category = 'NEWS';
    rescued = true;
  }

  const runnerUp = ranked[1]?.score ?? 0;
  const confidence = rescued
    ? // Se dedujo por descarte, no por evidencia positiva: se declara flojo.
      0.45
    : category === 'GENERAL'
      ? 0.35
      : Math.min(0.99, 0.5 + (winner.score - runnerUp) / 20 + Math.min(winner.score, 20) / 60);

  return {
    category,
    confidence: Number(confidence.toFixed(2)),
    extractedData: extractMetadata(category, fullText, email),
    scores,
    matched: rescued ? ['fallback:correo masivo sin senal comercial'] : (matchedByCategory[category] ?? []),
  };
}

/** Solo se extrae lo que la categoria va a mostrar: nada de trabajo desperdiciado. */
function extractMetadata(
  category: Category,
  text: string,
  email: ClassifiableEmail,
): ExtractedData {
  const data: ExtractedData = {};
  const reference = new Date(email.dateReceived);
  const refDate = Number.isNaN(reference.getTime()) ? new Date() : reference;

  if (category === 'FINANCE') {
    const amount = extractAmount(text);
    if (amount) {
      data.amount = amount.amount;
      data.amountValue = amount.amountValue;
      data.currency = amount.currency;
    }

    const due = extractDueDate(text, refDate);
    if (due) {
      data.dueDate = due.dueDate;
      data.dueDateRaw = due.dueDateRaw;
    }

    const tracking = extractTracking(text);
    if (tracking) data.trackingNumber = tracking;

    const carrier = extractCarrier(text);
    if (carrier) data.carrier = carrier;

    const merchant = extractMerchant(text, email.senderName, email.senderEmail);
    if (merchant) data.merchant = merchant;
  }

  if (category === 'URGENT') {
    const urgency = extractUrgency(text);
    if (urgency) {
      data.urgencyReason = urgency.urgencyReason;
      data.actionNeeded = urgency.actionNeeded;
    } else {
      data.urgencyReason = 'Marcado como urgente por el remitente';
      data.actionNeeded = 'Revisar el correo y decidir si requiere respuesta';
    }

    const due = extractDueDate(text, refDate);
    if (due) {
      data.dueDate = due.dueDate;
      data.dueDateRaw = due.dueDateRaw;
    }
  }

  if (category === 'JOB') {
    const role = extractRole(text);
    if (role) data.role = role;

    // Solo el remitente: una alerta con varias vacantes nombra muchas empresas
    // y elegir una del cuerpo seria adivinar.
    const company = organizationFromSender(email.senderName, email.senderEmail);
    if (company) data.company = company;

    const due = extractDueDate(text, refDate);
    if (due) {
      data.dueDate = due.dueDate;
      data.dueDateRaw = due.dueDateRaw;
    }
  }

  if (category === 'INTERESTING') {
    const due = extractDueDate(text, refDate);
    if (due) {
      data.dueDate = due.dueDate;
      data.dueDateRaw = due.dueDateRaw;
    }
  }

  return data;
}

/** Clasifica un lote. El motor no tiene estado, asi que es un simple map. */
export function classifyBatch(emails: ClassifiableEmail[]): ClassificationResult[] {
  return emails.map(classifyEmail);
}

export { normalize } from '@/lib/classifier/extractors';
