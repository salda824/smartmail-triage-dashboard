/**
 * Extractores de metadatos.
 *
 * Todo lo de aqui trabaja sobre texto plano (asunto + cuerpo) y devuelve
 * `undefined` cuando no hay una senal clara. Preferimos no extraer nada antes
 * que mostrar un dato inventado en la tarjeta.
 */

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

/** Quita tildes y pasa a minusculas para que los patrones no dependan de la ortografia. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // marcas diacriticas combinantes
    .toLowerCase();
}

const MONTHS_ES: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};

const MONTHS_EN: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function toIsoDate(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rechaza fechas imposibles como el 31 de febrero, que Date normalizaria en silencio.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Montos
// ---------------------------------------------------------------------------

export interface AmountResult {
  amount: string;
  amountValue: number;
  currency: string;
}

/**
 * Convierte "1.234.567,89" o "1,234,567.89" a 1234567.89.
 *
 * Regla: cuando aparecen los dos separadores, el ultimo es el decimal. Cuando
 * solo aparece uno, se trata como decimal unicamente si deja 1 o 2 digitos
 * detras (asi "50.000" se lee como cincuenta mil y no como cincuenta).
 */
export function parseNumericAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/\s/g, '');
  if (!/\d/.test(cleaned)) return undefined;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  let normalized: string;

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    normalized = cleaned.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const idx = lastDot >= 0 ? lastDot : lastComma;
    const decimals = cleaned.length - idx - 1;
    const occurrences = cleaned.split(sep).length - 1;

    if (occurrences === 1 && decimals > 0 && decimals <= 2) {
      normalized = cleaned.replace(sep, '.');
    } else {
      normalized = cleaned.split(sep).join('');
    }
  } else {
    normalized = cleaned;
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function formatAmount(value: number, currency: string): string {
  const locale = currency === 'COP' ? 'es-CO' : currency === 'EUR' ? 'es-ES' : 'en-US';
  const fractionDigits = currency === 'COP' && Number.isInteger(value) ? 0 : 2;
  try {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
    return `$${formatted} ${currency}`;
  } catch {
    return `$${value} ${currency}`;
  }
}

const AMOUNT_PATTERN =
  /(?:(us\$|u\$s|col\$|cop|usd|eur|mxn|ars|clp|pen|brl|gbp|\$|€|£)\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(cop|usd|eur|mxn|ars|clp|pen|brl|gbp|pesos|dolares|dolar|euros|d[oó]lares)?/gi;

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  'us$': 'USD',
  'u$s': 'USD',
  'col$': 'COP',
  usd: 'USD',
  cop: 'COP',
  eur: 'EUR',
  mxn: 'MXN',
  ars: 'ARS',
  clp: 'CLP',
  pen: 'PEN',
  brl: 'BRL',
  gbp: 'GBP',
  '€': 'EUR',
  '£': 'GBP',
};

const SUFFIX_TO_CURRENCY: Record<string, string> = {
  cop: 'COP',
  pesos: 'COP',
  usd: 'USD',
  dolares: 'USD',
  dolar: 'USD',
  eur: 'EUR',
  euros: 'EUR',
  mxn: 'MXN',
  ars: 'ARS',
  clp: 'CLP',
  pen: 'PEN',
  brl: 'BRL',
  gbp: 'GBP',
};

/** Contexto que indica que el numero cercano es realmente un cobro. */
const MONEY_CONTEXT =
  /(total|valor|monto|importe|pago|pagar|cobro|cargo|factura|saldo|precio|cuota|abono|deuda|amount|charged|payment|due|subtotal|balance)/;

/**
 * Busca el monto mas relevante del correo.
 *
 * Cuando hay varios candidatos gana el que tenga contexto monetario cerca; si
 * ninguno lo tiene, gana el mayor (normalmente el "total" del recibo).
 */
export function extractAmount(text: string): AmountResult | undefined {
  const source = normalize(text);
  const candidates: { value: number; currency: string; contextual: boolean }[] = [];

  for (const match of source.matchAll(AMOUNT_PATTERN)) {
    const [full, symbolRaw, numberRaw, suffixRaw] = match;
    const symbol = symbolRaw?.toLowerCase();
    const suffix = suffixRaw?.toLowerCase();

    // Sin simbolo ni sufijo de moneda no hay forma de saber que es dinero.
    if (!symbol && !suffix) continue;

    const value = parseNumericAmount(numberRaw);
    if (value === undefined || value <= 0) continue;
    // Descarta anios sueltos ("2026") y numeros de version.
    if (value >= 1900 && value <= 2100 && Number.isInteger(value) && !symbol) continue;

    let currency =
      (suffix ? SUFFIX_TO_CURRENCY[suffix] : undefined) ??
      (symbol ? SYMBOL_TO_CURRENCY[symbol] : undefined);

    // "$" a secas: en montos con miles agrupados asumimos pesos colombianos.
    if (!currency) currency = value >= 1000 && /[.,]/.test(numberRaw) ? 'COP' : 'USD';

    const start = match.index ?? 0;
    const window = source.slice(Math.max(0, start - 60), start + full.length + 30);

    candidates.push({ value, currency, contextual: MONEY_CONTEXT.test(window) });
  }

  if (candidates.length === 0) return undefined;

  const contextual = candidates.filter((c) => c.contextual);
  const pool = contextual.length > 0 ? contextual : candidates;
  const best = pool.reduce((a, b) => (b.value > a.value ? b : a));

  return {
    amount: formatAmount(best.value, best.currency),
    amountValue: best.value,
    currency: best.currency,
  };
}

// ---------------------------------------------------------------------------
// Fechas limite
// ---------------------------------------------------------------------------

export interface DueDateResult {
  dueDate: string;
  dueDateRaw: string;
}

const DUE_KEYWORDS =
  /(vence|vencimiento|fecha limite|fecha de corte|antes del|antes de|hasta el|plazo|pagar antes|expira|caduca|due date|due by|deadline|expires?|no later than|last day|cierre de inscripciones|fecha de pago)/;

/**
 * Busca una fecha limite. `reference` (la fecha del correo) sirve para resolver
 * expresiones relativas y para elegir el anio cuando el texto no lo dice.
 */
export function extractDueDate(text: string, reference: Date = new Date()): DueDateResult | undefined {
  const source = normalize(text);
  const candidates: { iso: string; raw: string; score: number; index: number }[] = [];

  const pushCandidate = (iso: string | undefined, raw: string, index: number) => {
    if (!iso) return;
    const window = source.slice(Math.max(0, index - 80), index);
    candidates.push({ iso, raw: raw.trim(), score: DUE_KEYWORDS.test(window) ? 2 : 0, index });
  };

  // ISO: 2026-03-20
  for (const m of source.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    pushCandidate(toIsoDate(+m[1], +m[2], +m[3]), m[0], m.index ?? 0);
  }

  // Numerica: 20/03/2026, 20-03-26, 20.03.2026 (dia primero, convencion es-CO)
  for (const m of source.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g)) {
    const day = +m[1];
    const month = +m[2];
    let year = +m[3];
    if (year < 100) year += 2000;
    pushCandidate(toIsoDate(year, month, day), m[0], m.index ?? 0);
  }

  // Textual espanol: "15 de marzo de 2026" / "15 de marzo"
  for (const m of source.matchAll(
    /\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de|del)\s+(\d{4}))?/g,
  )) {
    const month = MONTHS_ES[m[2]];
    if (!month) continue;
    const year = m[3] ? +m[3] : inferYear(month, +m[1], reference);
    pushCandidate(toIsoDate(year, month, +m[1]), m[0], m.index ?? 0);
  }

  // Textual ingles: "March 15, 2026" / "15 March 2026"
  for (const m of source.matchAll(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/g)) {
    const month = MONTHS_EN[m[1]];
    if (!month) continue;
    const year = m[3] ? +m[3] : inferYear(month, +m[2], reference);
    pushCandidate(toIsoDate(year, month, +m[2]), m[0], m.index ?? 0);
  }

  // Relativas: "en 3 dias", "dentro de las proximas 48 horas", "in the next 2 weeks".
  // El grupo intermedio absorbe el relleno ("las", "proximas", "next") que casi
  // siempre aparece entre la preposicion y el numero.
  for (const m of source.matchAll(
    /\b(?:en|dentro de|in|within)\s+(?:(?:las?|los?|the|proximas?|proximos?|siguientes?|siguiente|next)\s+){0,3}(\d{1,3})\s+(dias?|horas?|semanas?|days?|hours?|weeks?)\b/g,
  )) {
    const qty = +m[1];
    const unit = m[2];
    const ms = /hora|hour/.test(unit)
      ? qty * 3600_000
      : /semana|week/.test(unit)
        ? qty * 7 * 86_400_000
        : qty * 86_400_000;
    const iso = new Date(reference.getTime() + ms).toISOString().slice(0, 10);
    pushCandidate(iso, m[0], m.index ?? 0);
  }

  // Palabras sueltas de plazo inmediato
  for (const m of source.matchAll(/\b(hoy|manana|today|tomorrow)\b/g)) {
    const offset = /manana|tomorrow/.test(m[1]) ? 86_400_000 : 0;
    const iso = new Date(reference.getTime() + offset).toISOString().slice(0, 10);
    pushCandidate(iso, m[0], m.index ?? 0);
  }

  if (candidates.length === 0) return undefined;

  const refDay = reference.toISOString().slice(0, 10);
  // Preferimos: cerca de una palabra de plazo > en el futuro > mencionada antes.
  const best = candidates.sort((a, b) => {
    const futureA = a.iso >= refDay ? 1 : 0;
    const futureB = b.iso >= refDay ? 1 : 0;
    if (b.score !== a.score) return b.score - a.score;
    if (futureB !== futureA) return futureB - futureA;
    return a.index - b.index;
  })[0];

  return { dueDate: best.iso, dueDateRaw: best.raw };
}

/** Sin anio explicito: elige el que deje la fecha mas cerca del correo. */
function inferYear(month: number, day: number, reference: Date): number {
  const refYear = reference.getUTCFullYear();
  const sameYear = Date.UTC(refYear, month - 1, day);
  // Si la fecha ya paso hace mas de 6 meses, probablemente hablan del anio siguiente.
  return sameYear < reference.getTime() - 182 * 86_400_000 ? refYear + 1 : refYear;
}

// ---------------------------------------------------------------------------
// Envios y paqueteria
// ---------------------------------------------------------------------------

const CARRIERS: { name: string; pattern: RegExp }[] = [
  { name: 'Servientrega', pattern: /servientrega/ },
  { name: 'Coordinadora', pattern: /coordinadora/ },
  { name: 'Interrapidisimo', pattern: /inter\s?rapidisimo/ },
  { name: 'TCC', pattern: /\btcc\b/ },
  { name: 'Envia', pattern: /\benvia\b(?!\s*(?:un|el|la))/ },
  { name: '4-72', pattern: /\b4-72\b/ },
  { name: 'Deprisa', pattern: /deprisa/ },
  { name: 'DHL', pattern: /\bdhl\b/ },
  { name: 'FedEx', pattern: /\bfedex\b/ },
  { name: 'UPS', pattern: /\bups\b/ },
  { name: 'USPS', pattern: /\busps\b/ },
  { name: 'Amazon Logistics', pattern: /amazon\s+logistics/ },
  { name: 'Estafeta', pattern: /estafeta/ },
  { name: 'Correos', pattern: /\bcorreos\b/ },
];

export function extractCarrier(text: string): string | undefined {
  const source = normalize(text);
  return CARRIERS.find((c) => c.pattern.test(source))?.name;
}

const TRACKING_LABEL =
  /(?:numero de (?:guia|rastreo|seguimiento|envio)|n[.°o]?\s*de guia|guia|tracking(?:\s+(?:number|id|code))?|rastreo|seguimiento|awb|waybill)\s*(?:n[.°o]?|#|:|=|es|is)?\s*([a-z0-9][a-z0-9\-]{5,29})/i;

/** Formatos propios de las transportadoras grandes, validos sin etiqueta previa. */
const TRACKING_STANDALONE = [
  /\b1Z[0-9A-Z]{16}\b/i,            // UPS
  /\b\d{12}\b|\b\d{15}\b/,          // FedEx
  /\b[A-Z]{2}\d{9}[A-Z]{2}\b/,      // correo postal internacional
  /\b\d{10}\b/,                     // DHL
];

export function extractTracking(text: string): string | undefined {
  const labelled = text.match(TRACKING_LABEL);
  if (labelled?.[1]) {
    const value = labelled[1].toUpperCase();
    // Descarta capturas que son solo palabras.
    if (/\d/.test(value)) return value;
  }

  const hasShippingContext = /(guia|rastreo|seguimiento|tracking|envio|paquete|shipment|package|delivery)/i.test(
    normalize(text),
  );
  if (!hasShippingContext) return undefined;

  for (const pattern of TRACKING_STANDALONE) {
    const match = text.match(pattern);
    if (match) return match[0].toUpperCase();
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Comercio / remitente
// ---------------------------------------------------------------------------

const KNOWN_MERCHANTS = [
  'Bancolombia', 'Davivienda', 'Nequi', 'Daviplata', 'Banco de Bogota', 'BBVA', 'Nubank',
  'Scotiabank', 'Itau', 'Falabella', 'Rappi', 'Mercado Pago', 'Mercado Libre', 'PayU',
  'Wompi', 'PSE', 'Amazon', 'PayPal', 'Stripe', 'Netflix', 'Spotify', 'Apple', 'Google',
  'Microsoft', 'Adobe', 'OpenAI', 'Anthropic', 'Claro', 'Movistar', 'Tigo', 'EPM',
  'Codensa', 'Enel', 'Vanti', 'Uber', 'DiDi', 'Steam', 'Shein', 'AliExpress', 'Temu',
];

/**
 * Identifica el comercio: primero por nombre conocido en el texto, si no por el
 * dominio del remitente (mas fiable que el display name, que es falsificable).
 */
export function extractMerchant(text: string, senderName: string, senderEmail: string): string | undefined {
  const source = normalize(`${text} ${senderName} ${senderEmail}`);

  const known = KNOWN_MERCHANTS.find((m) => source.includes(normalize(m)));
  if (known) return known;

  return organizationFromSender(senderName, senderEmail);
}

/**
 * Organizacion que envia el correo, derivada del dominio.
 *
 * A diferencia de `extractMerchant`, no busca nombres conocidos dentro del
 * cuerpo: en una alerta de empleo que lista diez empresas, la unica que se
 * puede afirmar con certeza es la que aparece en el remitente.
 */
export function organizationFromSender(senderName: string, senderEmail: string): string | undefined {
  const domain = senderEmail.split('@')[1]?.toLowerCase();

  if (domain) {
    const base = domain
      .replace(/^(mail|email|no-?reply|notifications?|info|news|alerts?|smtp|mg|em)\./, '')
      .replace(/\.(com|net|org|co|io|app|mx|ar|cl|pe|br|es|us|edu|gov)(\.[a-z]{2})?$/, '')
      .split('.')
      .pop();
    if (base && base.length > 2) return base.charAt(0).toUpperCase() + base.slice(1);
  }

  return senderName || undefined;
}

// ---------------------------------------------------------------------------
// Empleo
// ---------------------------------------------------------------------------

const ROLE_PATTERN =
  /\b((?:senior|junior|jr|sr|semi\s?senior|lead|principal|full[\s-]?stack|frontend|front[\s-]?end|backend|back[\s-]?end|mobile|data|devops|cloud|qa|ux|ui|software|web|machine learning|ml|ai)\s+(?:engineer|developer|desarrollador[a]?|ingenier[oa]|analyst|analista|designer|disenador[a]?|scientist|cientifico|architect|arquitect[oa]|intern|practicante|pasante)|(?:desarrollador[a]?|ingenier[oa]|analista|practicante|pasante|intern(?:ship)?|becari[oa])(?:\s+(?:de|en)\s+[a-z]+)?)\b/i;

export function extractRole(text: string): string | undefined {
  const match = text.match(ROLE_PATTERN);
  if (!match) return undefined;
  return match[1]
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Urgencia
// ---------------------------------------------------------------------------

/**
 * El orden importa: gana la primera regla que coincida, asi que van de la mas
 * especifica a la mas generica. "Confirmar" aparece en casi todo correo
 * transaccional, por eso su regla va casi al final y no se lleva casos que en
 * realidad tratan de un pago rechazado o de un cupo por cancelarse.
 */
const URGENCY_REASONS: { pattern: RegExp; reason: string; action: string }[] = [
  {
    pattern:
      /(codigo de (?:seguridad|verificacion|acceso)|two[- ]factor|2fa|\botp\b|one[- ]time (?:code|password)|verification code|security code)/,
    reason: 'Requiere un codigo de verificacion',
    action: 'Ingresar el codigo antes de que expire',
  },
  {
    pattern:
      /(pago (?:pendiente|vencido|rechazado)|no pudimos procesar el pago|mora|saldo pendiente|payment (?:failed|declined|overdue)|past due)/,
    reason: 'Pago pendiente, vencido o rechazado',
    action: 'Actualizar el medio de pago o regularizar el saldo',
  },
  {
    pattern:
      /(suspension|suspendid|bloquead|desactivad|cancelacion|cancelad|cerrar[ae] tu cuenta|account (?:suspended|locked|closed))/,
    reason: 'Riesgo de cancelacion o suspension si no actuas',
    action: 'Actuar antes de la fecha indicada para evitar la cancelacion',
  },
  {
    pattern:
      /(vence hoy|vence manana|ultimo dia|ultima oportunidad|expires today|final notice|ultimo aviso|deadline)/,
    reason: 'El plazo esta por vencerse',
    action: 'Atender antes de la fecha limite',
  },
  {
    pattern: /(entrevista|interview|prueba tecnica|technical (?:test|assessment)|schedule a call)/,
    reason: 'Entrevista o prueba tecnica pendiente de agendar',
    action: 'Responder con tu disponibilidad',
  },
  {
    pattern:
      /(actividad (?:sospechosa|inusual)|inicio de sesion|new sign[- ]?in|suspicious activity|security alert)/,
    reason: 'Alerta de seguridad sobre un inicio de sesion',
    action: 'Verificar si el acceso fue tuyo',
  },
  {
    pattern: /(reunion|meeting|invitacion de calendario|calendar invite|rsvp)/,
    reason: 'Invitacion o cambio en una reunion',
    action: 'Confirmar asistencia',
  },
  {
    pattern: /(confirmar|confirmacion|confirma tu|verificar|verificacion|validar)/,
    reason: 'Requiere una confirmacion de tu parte',
    action: 'Completar la confirmacion desde el correo original',
  },
  {
    pattern:
      /(responder|respuesta|reply|awaiting your|necesitamos tu|requiere tu (?:respuesta|accion)|action required)/,
    reason: 'Esperan una respuesta tuya',
    action: 'Responder al remitente',
  },
];

export interface UrgencyResult {
  urgencyReason: string;
  actionNeeded: string;
}

export function extractUrgency(text: string): UrgencyResult | undefined {
  const source = normalize(text);
  const hit = URGENCY_REASONS.find((r) => r.pattern.test(source));
  if (!hit) return undefined;
  return { urgencyReason: hit.reason, actionNeeded: hit.action };
}
