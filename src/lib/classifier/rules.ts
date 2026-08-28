import type { Category } from '@/types/email';

/**
 * Reglas de clasificacion.
 *
 * Cada categoria acumula puntos por senales encontradas en el remitente, el
 * asunto y el cuerpo. Las senales del remitente pesan mas que las del cuerpo:
 * un correo de `linkedin.com` es una oferta laboral aunque el cuerpo hable de
 * cualquier cosa, mientras que la palabra "urgente" en el cuerpo puede ser ruido.
 */

export interface Signal {
  pattern: RegExp;
  weight: number;
  /** Etiqueta legible, util para depurar por que cayo en una categoria. */
  label: string;
}

export interface CategoryRules {
  category: Category;
  /** Dominios del remitente que por si solos casi deciden la categoria. */
  domains: Signal[];
  subject: Signal[];
  body: Signal[];
  /** Puntos extra si el asunto y el cuerpo coinciden en la misma categoria. */
  priority: number;
}

const s = (pattern: RegExp, weight: number, label: string): Signal => ({ pattern, weight, label });

// ---------------------------------------------------------------------------
// 1. Empleo y practicas
// ---------------------------------------------------------------------------

const JOB: CategoryRules = {
  category: 'JOB',
  priority: 6,
  domains: [
    // Solo los buzones de alertas de empleo de LinkedIn. Un `linkedin.com` a
    // secas arrastraba a esta categoria las invitaciones, los mensajes y los
    // avisos de "vieron tu perfil", que son red social, no ofertas.
    s(/(jobalerts|job-alerts|jobs-listings|jobs-noreply)[\w.-]*@[\w.-]*linkedin\.com/, 6, 'alertas de empleo de linkedin'),
    s(/(indeed|glassdoor|computrabajo|elempleo|magneto365|hiring\.cafe|lever\.co|greenhouse\.io|workable|smartrecruiters|bamboohr|ashbyhq|jobvite|talent\.com|occ\.com|bumeran|zonajobs|getonbrd|torre\.(ai|co)|wellfound|angel\.co)/, 5, 'portal de empleo'),
    // Plataformas de seguimiento de candidatos: si escriben, es por un proceso.
    s(/(teamtailor|myworkday|workday|successfactors|taleo|icims|avature|recruitee|personio|factorial)/, 5, 'plataforma de reclutamiento'),
    s(/(talent|careers?|recruit|rrhh|reclutamiento|jobs|empleo|seleccion|hiring)/, 3, 'buzon de reclutamiento'),
  ],
  subject: [
    s(/\b(vacante|vacantes|oferta laboral|oferta de (?:empleo|trabajo)|convocatoria|puesto)\b/, 5, 'vacante'),
    s(/\b(practica|practicas|pasantia|pasantias|internship|intern|becari[oa]|trainee|aprendiz|contrato de aprendizaje)\b/, 5, 'practicas'),
    s(/\b(proceso de seleccion|entrevista|interview|prueba tecnica|assessment|hoja de vida|curriculum|cv|resume|aplicacion|application)\b/, 4, 'proceso de seleccion'),
    s(/\b(estamos contratando|we're hiring|were hiring|now hiring|job alert|alerta de empleo|nuevas ofertas|new jobs?|jobs? for you|empleos para ti)\b/, 5, 'alerta de empleo'),
    s(/\b(reclutador|recruiter|talent acquisition|headhunter|oportunidad laboral)\b/, 4, 'reclutador'),
  ],
  body: [
    s(/\b(vacante|oferta laboral|postulacion|postularte|postular|aplicar a(?:l)? (?:cargo|puesto|vacante))\b/, 3, 'postulacion'),
    s(/\b(salario|remuneracion|compensacion|salary range|compensation)\b/, 2, 'salario'),
    s(/\b(jornada|tiempo completo|medio tiempo|full[- ]time|part[- ]time|modalidad (?:remota|hibrida|presencial)|remote|hybrid|on[- ]site)\b/, 2, 'modalidad'),
    s(/\b(perfil|requisitos|responsabilidades|requirements|responsibilities|qualifications)\b/, 2, 'descripcion de cargo'),
    s(/\b(practicante|pasante|semestre de practica|practica profesional|practica empresarial)\b/, 3, 'practicante'),
    // Acuses de recibo de postulacion: llegan sin palabras de vacante en el
    // asunto, pero son la parte del proceso que mas importa seguir.
    s(/(your application|tu postulacion|hemos recibido tu (?:solicitud|postulacion)|we have (?:successfully )?received your application|thank you for applying|thank you for your interest in (?:employment|working)|gracias por (?:postularte|aplicar)|job application|internship position|for the (?:internship|intern) position)/, 5, 'acuse de postulacion'),
    s(/\b(internship|intern|trainee|graduate program|programa de internship)\b/, 3, 'programa de practicas'),
  ],
};

// ---------------------------------------------------------------------------
// 2. Urgente / accion requerida
// ---------------------------------------------------------------------------

const URGENT: CategoryRules = {
  category: 'URGENT',
  priority: 8,
  domains: [
    s(/(security|alerts?|no-?reply@(?:accounts\.)?google\.com|accounts\.google)/, 2, 'buzon de alertas'),
  ],
  subject: [
    s(/\b(urgente|urgent|inmediato|immediately|asap|critico|critical|emergencia|emergency)\b/, 6, 'urgente'),
    s(/\b(accion requerida|action required|requiere tu atencion|requires your attention|respuesta requerida|response required|se requiere tu)\b/, 6, 'accion requerida'),
    s(/\b(ultimo (?:aviso|dia|recordatorio)|final notice|last chance|ultima oportunidad|vence hoy|vence manana|expires? (?:today|tomorrow)|expiring soon|por vencer)\b/, 6, 'plazo inminente'),
    s(/\b(verifica|verificar|verify|confirma|confirmar|confirm your|codigo de (?:verificacion|seguridad)|verification code|security code|one[- ]time)\b/, 5, 'verificacion'),
    s(/\b(cuenta (?:suspendida|bloqueada|desactivada|en riesgo)|account (?:suspended|locked|disabled|at risk)|suspension|acceso bloqueado)\b/, 6, 'cuenta en riesgo'),
    s(/\b(alerta de seguridad|security alert|actividad (?:sospechosa|inusual)|suspicious activity|nuevo inicio de sesion|new sign[- ]?in|unusual sign)\b/, 5, 'alerta de seguridad'),
    s(/\b(recordatorio|reminder|pendiente|pending|overdue|vencido|en mora)\b/, 3, 'recordatorio'),
  ],
  body: [
    s(/\b(antes del|antes de las|fecha limite|deadline|due (?:by|date)|no later than|plazo maximo|hasta el)\b/, 3, 'plazo'),
    s(/\b(responder(?:nos)? (?:a la brevedad|cuanto antes|hoy)|reply (?:asap|today|immediately)|necesitamos tu respuesta|awaiting your response)\b/, 4, 'respuesta esperada'),
    s(/\b(24 horas|48 horas|72 horas|24 hours|48 hours|72 hours)\b/, 3, 'ventana corta'),
    s(/\b(sera (?:cancelad|suspendid|eliminad)|will be (?:cancelled|canceled|suspended|deleted|terminated))\b/, 4, 'consecuencia'),
  ],
};

// ---------------------------------------------------------------------------
// 3. Pagos, facturas y envios
// ---------------------------------------------------------------------------

const FINANCE: CategoryRules = {
  category: 'FINANCE',
  priority: 7,
  domains: [
    s(/(bancolombia|davivienda|nequi|daviplata|bancodebogota|bbva|scotiabank|itau|nubank|falabella)/, 6, 'banco'),
    s(/(paypal|stripe|mercadopago|mercadolibre|payu|wompi|epayco|square|wise|payoneer)/, 6, 'pasarela de pago'),
    // Las siglas cortas van con limites de palabra: sin ellos, `ups` hacia
    // match dentro de "groups-noreply@..." y mandaba correo social a finanzas.
    s(/(servientrega|coordinadora|interrapidisimo|deprisa|fedex|estafeta|\bups\b|\busps\b|\bdhl\b|\btcc\b|\b4-72\b)/, 6, 'transportadora'),
    s(/(amazon|rappi|shein|aliexpress|temu|ebay|shopify|steam)/, 4, 'comercio'),
    s(/(billing|invoice|facturacion|pagos|cobros|receipts?)/, 4, 'buzon de facturacion'),
  ],
  subject: [
    s(/\b(factura|facturas|invoice|recibo|receipt|comprobante|extracto|estado de cuenta|statement)\b/, 6, 'factura'),
    s(/\b(pago|payment|cobro|charge|cargo|transaccion|transaction|transferencia|transfer|abono|debito|credito)\b/, 5, 'pago'),
    s(/\b(tu (?:pedido|compra|orden)|your (?:order|purchase)|order (?:confirmation|placed|shipped)|confirmacion de (?:compra|pedido))\b/, 5, 'pedido'),
    s(/\b(envio|envio en camino|shipment|shipping|entrega|delivery|paquete|package|guia|tracking|rastreo|en camino|out for delivery)\b/, 5, 'envio'),
    s(/\b(suscripcion|subscription|renovacion|renewal|membresia|membership|plan)\b/, 3, 'suscripcion'),
    s(/\b(vencimiento|fecha de corte|due date|saldo|balance|cuota)\b/, 4, 'vencimiento'),
  ],
  body: [
    s(/\b(total a pagar|valor total|monto total|total amount|amount due|subtotal|iva|impuesto|tax)\b/, 4, 'total'),
    s(/\b(numero de (?:guia|rastreo|seguimiento)|tracking number|numero de factura|invoice number|numero de orden|order number)\b/, 4, 'identificador'),
    s(/\b(tarjeta terminada en|card ending in|cuenta terminada en|ending in \d{4}|\*{2,}\d{4})\b/, 4, 'medio de pago'),
    s(/\b(metodo de pago|payment method|forma de pago|pse|tarjeta de credito|credit card|debito automatico)\b/, 3, 'medio de pago'),
    // Facturacion electronica colombiana (DIAN). El asunto de estos correos es
    // un codigo sin palabras, asi que toda la senal esta en el cuerpo. Van como
    // tres senales independientes y no como una: el cuerpo pesa la mitad, y una
    // sola no alcanzaba el umbral pese a ser evidencia inequivoca.
    s(/(factura electronica|documento equivalente|documento soporte|nota (?:credito|debito)|\bcufe\b)/, 7, 'documento electronico'),
    s(/(razon social|\bnit\b|adquirente|datos del emisor)/, 5, 'datos tributarios'),
    s(/(\bdian\b|resolucion de facturacion|numeracion autorizada)/, 4, 'resolucion dian'),
  ],
};

// ---------------------------------------------------------------------------
// 4. Noticias y boletines
// ---------------------------------------------------------------------------

const NEWS: CategoryRules = {
  category: 'NEWS',
  priority: 3,
  domains: [
    s(/(substack|beehiiv|mailchimp|convertkit|ghost\.io|revue|buttondown|tinyletter|sendgrid\.net)/, 5, 'plataforma de newsletter'),
    s(/(techcrunch|theverge|wired|arstechnica|hackernews|medium|dev\.to|infoq|smashingmagazine|producthunt|morningbrew|axios|reuters|bloomberg|elpais|eltiempo|semana|larepublica|portafolio)/, 5, 'medio'),
    // Senal debil a proposito. Las tiendas usan `newsletter@` y subdominios
    // `news.` tanto como los medios: con peso alto, este patron metia en
    // Noticias el merchandising de un club de futbol y las ofertas de vuelos,
    // mientras los boletines editoriales de verdad se quedaban en General.
    // Con peso 2 ya no alcanza el umbral por si solo; necesita apoyo del
    // asunto o del cuerpo.
    s(/(newsletter|boletin|digest|noticias)/, 2, 'buzon de boletin'),
  ],
  subject: [
    s(/\b(newsletter|boletin|digest|resumen (?:semanal|diario|mensual)|weekly (?:digest|roundup|recap)|daily (?:digest|brief|update)|edicion|issue #?\d+)\b/, 6, 'boletin'),
    s(/\b(noticias|news|titulares|headlines|lo mas leido|top stories|esta semana en|this week in)\b/, 5, 'noticias'),
    s(/\b(novedades|updates|whats new|que hay de nuevo|release notes|changelog|anuncio|announcing)\b/, 3, 'novedades'),
  ],
  body: [
    s(/\b(darse de baja|cancelar suscripcion|unsubscribe|manage (?:your )?preferences|preferencias de correo|ver en el navegador|view in browser)\b/, 3, 'pie de newsletter'),
    s(/\b(en esta edicion|in this issue|contenido de hoy|todays? (?:stories|picks)|lo destacado)\b/, 4, 'indice de edicion'),
  ],
};

// ---------------------------------------------------------------------------
// 5. Interesantes / lecturas
// ---------------------------------------------------------------------------

const INTERESTING: CategoryRules = {
  category: 'INTERESTING',
  priority: 4,
  domains: [
    s(/(coursera|udemy|edx|platzi|domestika|datacamp|pluralsight|codecademy|freecodecamp|khanacademy)/, 5, 'plataforma educativa'),
    s(/(eventbrite|meetup|luma|lu\.ma|hopin|zoom\.us|webinar)/, 4, 'plataforma de eventos'),
    s(/(github|gitlab|stackoverflow|kaggle|arxiv|researchgate)/, 3, 'comunidad tecnica'),
  ],
  subject: [
    s(/\b(webinar|master\s?class|workshop|taller|charla|conferencia|conference|meetup|hackathon|bootcamp|summit|clase magistral)\b/, 6, 'evento formativo'),
    s(/\b(curso|course|certificacion|certification|diplomado|especializacion|specialization|capacitacion|training)\b/, 5, 'curso'),
    s(/\b(guia|guide|tutorial|como (?:hacer|crear|construir)|how to|paso a paso|step by step|deep dive|case study|caso de estudio)\b/, 4, 'lectura larga'),
    s(/\b(invitacion|invitation|te invitamos|you're invited|youre invited|registrate|register now|inscribete)\b/, 4, 'invitacion'),
    s(/\b(ebook|whitepaper|informe|report|investigacion|research|paper|estudio)\b/, 4, 'recurso'),
    s(/\b(recomendad[oa]s? para ti|recommended for you|te puede interesar|you might like|lecturas)\b/, 4, 'recomendacion'),
  ],
  body: [
    s(/\b(tiempo de lectura|min(?:utos)? de lectura|reading time|\d+ min read)\b/, 4, 'tiempo de lectura'),
    s(/\b(cupos limitados|limited seats|reserva tu lugar|save your spot|agenda|agenda del evento|ponentes|speakers)\b/, 3, 'detalle de evento'),
    s(/\b(gratuito|gratis|sin costo|free|beca|scholarship|descuento en el curso)\b/, 2, 'acceso gratuito'),
  ],
};

export const RULES: CategoryRules[] = [URGENT, JOB, FINANCE, INTERESTING, NEWS];

/**
 * Remitentes automaticos.
 *
 * Se usan para bajar el sesgo hacia "Urgente" en correos masivos que dicen
 * "confirma tu correo" sin que haya nada que atender. La penalizacion solo se
 * aplica cuando el asunto no disparo ninguna senal de urgencia: una alerta de
 * seguridad real tambien llega desde un `no-reply` y no debe castigarse.
 */
export const NOISE_SENDERS =
  /(no-?reply|noreply|do-?not-?reply|notifications?@|mailer-daemon|postmaster|automated)/i;
