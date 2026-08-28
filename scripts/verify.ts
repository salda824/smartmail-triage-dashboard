import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from './_env';

loadEnv();

// Las pruebas escriben y borran filas: nunca deben tocar la base real del usuario.
const TEST_DB = path.join(process.cwd(), 'data', 'verify.db');
process.env.SMARTMAIL_DB_PATH = TEST_DB;
process.env.MAIL_SOURCE = 'demo';
for (const suffix of ['', '-wal', '-shm']) {
  const file = `${TEST_DB}${suffix}`;
  if (fs.existsSync(file)) fs.rmSync(file);
}

/**
 * Pruebas de humo del motor de clasificacion y de la capa de datos.
 *
 * Cubre lo que el enunciado pide verificar: que cada categoria reciba los
 * correos correctos, que la extraccion de montos, fechas y guias funcione, y
 * que el ciclo completo (sincronizar -> leer -> marcar -> borrar) no rompa.
 *
 *   npm run verify
 */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

async function main() {
  const { classifyEmail } = await import('../src/lib/classifier');
  const { extractAmount, extractDueDate, extractTracking, parseNumericAmount, normalize } =
    await import('../src/lib/classifier/extractors');
  const { buildDemoMessages } = await import('../src/lib/gmail/demo-data');

  // -------------------------------------------------------------------------
  section('Normalizacion de texto');
  // -------------------------------------------------------------------------
  check('quita tildes', normalize('Facturación Rápida') === 'facturacion rapida', normalize('Facturación Rápida'));
  check('quita enie', normalize('MAÑANA') === 'manana', normalize('MAÑANA'));

  // -------------------------------------------------------------------------
  section('Parsing de numeros');
  // -------------------------------------------------------------------------
  check('formato colombiano 50.000', parseNumericAmount('50.000') === 50000, String(parseNumericAmount('50.000')));
  check('formato US 1,234.56', parseNumericAmount('1,234.56') === 1234.56, String(parseNumericAmount('1,234.56')));
  check('formato EU 1.234,56', parseNumericAmount('1.234,56') === 1234.56, String(parseNumericAmount('1.234,56')));
  check('decimal simple 99.99', parseNumericAmount('99.99') === 99.99, String(parseNumericAmount('99.99')));
  check('miles largos 1.234.567', parseNumericAmount('1.234.567') === 1234567, String(parseNumericAmount('1.234.567')));

  // -------------------------------------------------------------------------
  section('Extraccion de montos');
  // -------------------------------------------------------------------------
  const cop = extractAmount('Total a pagar: $487.350 COP antes del corte');
  check('detecta monto COP', cop?.amountValue === 487350 && cop.currency === 'COP', JSON.stringify(cop));

  const usd = extractAmount('Order Total: USD 129.99 charged to your card');
  check('detecta monto USD', usd?.amountValue === 129.99 && usd.currency === 'USD', JSON.stringify(usd));

  check('ignora texto sin moneda', extractAmount('Reunion a las 1500 personas') === undefined);

  const multiple = extractAmount('Pago minimo: $58.900 COP. Total a pagar: $487.350 COP');
  check('elige el total, no el minimo', multiple?.amountValue === 487350, JSON.stringify(multiple));

  // -------------------------------------------------------------------------
  section('Extraccion de fechas limite');
  // -------------------------------------------------------------------------
  const ref = new Date('2026-08-27T12:00:00Z');

  const numeric = extractDueDate('Fecha limite de pago: 10/09/2026', ref);
  check('fecha numerica dd/mm/yyyy', numeric?.dueDate === '2026-09-10', JSON.stringify(numeric));

  const textual = extractDueDate('Debes confirmar antes del 30 de agosto de 2026', ref);
  check('fecha textual en espanol', textual?.dueDate === '2026-08-30', JSON.stringify(textual));

  const english = extractDueDate('Estimated delivery: September 2, 2026', ref);
  check('fecha textual en ingles', english?.dueDate === '2026-09-02', JSON.stringify(english));

  const relative = extractDueDate('Actualiza tu pago dentro de las proximas 48 horas', ref);
  check('fecha relativa en horas', relative?.dueDate === '2026-08-29', JSON.stringify(relative));

  check('sin fecha devuelve undefined', extractDueDate('Hola, te comparto las fotos', ref) === undefined);

  // -------------------------------------------------------------------------
  section('Extraccion de guias de envio');
  // -------------------------------------------------------------------------
  const guia = extractTracking('Numero de guia: 2104558873 - Servientrega');
  check('guia con etiqueta', guia === '2104558873', String(guia));

  const ups = extractTracking('Carrier: UPS Tracking number: 1Z999AA10123456784');
  check('guia formato UPS', ups === '1Z999AA10123456784', String(ups));

  check('no inventa guia sin contexto', extractTracking('El codigo postal es 110111') === undefined);

  // -------------------------------------------------------------------------
  section('Clasificacion por categoria');
  // -------------------------------------------------------------------------
  const expected: Record<string, string> = {
    'demo-job-01': 'JOB',
    'demo-job-02': 'JOB',
    'demo-job-03': 'JOB',
    'demo-urgent-01': 'URGENT',
    'demo-urgent-02': 'URGENT',
    'demo-urgent-03': 'URGENT',
    'demo-finance-01': 'FINANCE',
    'demo-finance-02': 'FINANCE',
    'demo-finance-03': 'FINANCE',
    'demo-finance-04': 'FINANCE',
    'demo-finance-05': 'FINANCE',
    'demo-news-01': 'NEWS',
    'demo-news-02': 'NEWS',
    'demo-news-03': 'NEWS',
    'demo-interesting-01': 'INTERESTING',
    'demo-interesting-02': 'INTERESTING',
    'demo-interesting-03': 'INTERESTING',
    'demo-promo-01': 'PROMO',
    'demo-promo-02': 'PROMO',
    'demo-general-01': 'GENERAL',
  };

  const messages = buildDemoMessages(ref);
  for (const message of messages) {
    const want = expected[message.id];
    if (!want) continue;

    const result = classifyEmail({
      subject: message.subject,
      senderName: message.senderName,
      senderEmail: message.senderEmail,
      body: message.body,
      dateReceived: message.dateReceived,
    });

    check(
      `${message.id} -> ${want}`,
      result.category === want,
      `obtuvo ${result.category} (scores ${JSON.stringify(result.scores)})`,
    );
  }

  // -------------------------------------------------------------------------
  section('Enriquecimiento de tarjetas');
  // -------------------------------------------------------------------------
  const extracto = messages.find((m) => m.id === 'demo-finance-01')!;
  const extractoResult = classifyEmail({ ...extracto, body: extracto.body });
  check(
    'extracto bancario trae monto',
    extractoResult.extractedData.amountValue === 487350,
    JSON.stringify(extractoResult.extractedData),
  );
  check(
    'extracto bancario trae comercio',
    extractoResult.extractedData.merchant === 'Bancolombia',
    String(extractoResult.extractedData.merchant),
  );

  const envio = messages.find((m) => m.id === 'demo-finance-02')!;
  const envioResult = classifyEmail({ ...envio, body: envio.body });
  check(
    'envio trae guia y transportadora',
    envioResult.extractedData.trackingNumber === '2104558873' &&
      envioResult.extractedData.carrier === 'Servientrega',
    JSON.stringify(envioResult.extractedData),
  );

  const urgente = messages.find((m) => m.id === 'demo-urgent-02')!;
  const urgenteResult = classifyEmail({ ...urgente, body: urgente.body });
  check(
    'urgente trae motivo y accion',
    Boolean(urgenteResult.extractedData.urgencyReason && urgenteResult.extractedData.actionNeeded),
    JSON.stringify(urgenteResult.extractedData),
  );
  check(
    'el motivo de urgencia describe el riesgo real (cancelacion, no identidad)',
    /cancelacion/i.test(urgenteResult.extractedData.urgencyReason ?? ''),
    String(urgenteResult.extractedData.urgencyReason),
  );

  const netflix = messages.find((m) => m.id === 'demo-urgent-03')!;
  const netflixResult = classifyEmail({ ...netflix, body: netflix.body });
  check(
    'pago rechazado gana sobre suspension generica',
    /pago/i.test(netflixResult.extractedData.urgencyReason ?? ''),
    String(netflixResult.extractedData.urgencyReason),
  );

  const alerta = messages.find((m) => m.id === 'demo-urgent-01')!;
  const alertaResult = classifyEmail({ ...alerta, body: alerta.body });
  check(
    'alerta de seguridad conserva su motivo propio',
    /inicio de sesion/i.test(alertaResult.extractedData.urgencyReason ?? ''),
    String(alertaResult.extractedData.urgencyReason),
  );

  const linkedin = messages.find((m) => m.id === 'demo-job-01')!;
  const linkedinResult = classifyEmail({ ...linkedin, body: linkedin.body });
  check(
    'la empresa sale del remitente, no de las vacantes del cuerpo',
    linkedinResult.extractedData.company === 'Linkedin',
    String(linkedinResult.extractedData.company),
  );
  check(
    'la oferta trae el cargo detectado',
    linkedinResult.extractedData.role === 'Full Stack Developer',
    String(linkedinResult.extractedData.role),
  );

  // -------------------------------------------------------------------------
  section('Casos de regresion (fallos vistos con correo real)');
  // -------------------------------------------------------------------------

  const classifyCase = (
    senderEmail: string,
    subject: string,
    body: string,
    senderName = '',
  ) =>
    classifyEmail({
      senderEmail,
      senderName: senderName || senderEmail.split('@')[0],
      subject,
      body,
      dateReceived: ref.toISOString(),
    }).category;

  // "ups" hacia match dentro de "groups-noreply@..." y mandaba correo social
  // de LinkedIn a la categoria de transportadoras.
  check(
    'groups-noreply@linkedin no cae en FINANCE',
    classifyCase(
      'groups-noreply@linkedin.com',
      'No te pierdas las conversaciones de Inteligencia Artificial',
      'Mira las publicaciones recomendadas del grupo.',
    ) !== 'FINANCE',
    classifyCase(
      'groups-noreply@linkedin.com',
      'No te pierdas las conversaciones de Inteligencia Artificial',
      'Mira las publicaciones recomendadas del grupo.',
    ),
  );

  check(
    'un envio real de UPS sigue en FINANCE',
    classifyCase(
      'mcinfo@ups.com',
      'Your UPS package is on the way',
      'Tracking number: 1Z999AA10123456784. Estimated delivery September 2.',
    ) === 'FINANCE',
  );

  // LinkedIn: alertas de empleo si, red social no.
  check(
    'alerta de empleo de LinkedIn -> JOB',
    classifyCase(
      'jobalerts-noreply@linkedin.com',
      'Mercado Libre - Senior Software Engineer Backend publicado el 8/25/26',
      'Ver empleos en Bogota. Nuevas vacantes que coinciden con tu busqueda guardada.',
    ) === 'JOB',
  );
  check(
    'invitacion de contacto de LinkedIn no es JOB',
    classifyCase(
      'invitations@linkedin.com',
      'Te he enviado una solicitud de contacto',
      'Brandon Eduardo esta esperando tu respuesta.',
    ) !== 'JOB',
    classifyCase(
      'invitations@linkedin.com',
      'Te he enviado una solicitud de contacto',
      'Brandon Eduardo esta esperando tu respuesta.',
    ),
  );
  check(
    'aviso de "vieron tu perfil" no es JOB',
    classifyCase(
      'messages-noreply@linkedin.com',
      '5 personas han visto tu perfil',
      'Tu perfil no pasa desapercibido.',
    ) !== 'JOB',
  );

  // Acuse de postulacion: el asunto no menciona vacante, la senal esta en el cuerpo.
  check(
    'acuse de postulacion -> JOB',
    classifyCase(
      'Recruitment@woodplc.com',
      'Thank you for your interest in Wood',
      'Dear Juan, Thank you for your interest in Wood and your application for the Internship position in Bogota, Colombia.',
    ) === 'JOB',
    classifyCase(
      'Recruitment@woodplc.com',
      'Thank you for your interest in Wood',
      'Dear Juan, Thank you for your interest in Wood and your application for the Internship position in Bogota, Colombia.',
    ),
  );

  check(
    'correo de un ATS (teamtailor) -> JOB',
    classifyCase(
      'no-reply@qualacompany.teamtailor-mail.com',
      'Inicia sesion en Quala Internacional',
      'Haz clic en el enlace para iniciar sesion en Connect.',
    ) === 'JOB',
  );

  // Factura electronica DIAN: asunto sin palabras, todo el peso en el cuerpo.
  check(
    'factura electronica colombiana -> FINANCE',
    classifyCase(
      'notificaciones@thefactoryhka.com.co',
      '860075558;UNIVERSIDAD DE LA SABANA;UPQ134855;01;',
      'Tipo de Documento: Factura Electronica de Venta. DATOS DEL ADQUIRENTE Nit: 222222222222 Razon Social: Consumidor Final.',
    ) === 'FINANCE',
    classifyCase(
      'notificaciones@thefactoryhka.com.co',
      '860075558;UNIVERSIDAD DE LA SABANA;UPQ134855;01;',
      'Tipo de Documento: Factura Electronica de Venta. DATOS DEL ADQUIRENTE Nit: 222222222222 Razon Social: Consumidor Final.',
    ),
  );

  // "Master Class" en dos palabras no casaba con el patron "masterclass".
  check(
    'invitacion a Master Class -> INTERESTING',
    classifyCase(
      'hola@imhapi.app',
      'Invitacion: Juan, Invitacion Master Class Hapi: Cripto mas alla del precio',
      'Piero Sifuentes y Camilo analizan que mueve realmente al mercado cripto. 60 min en vivo.',
    ) === 'INTERESTING',
    classifyCase(
      'hola@imhapi.app',
      'Invitacion: Juan, Invitacion Master Class Hapi: Cripto mas alla del precio',
      'Piero Sifuentes y Camilo analizan que mueve realmente al mercado cripto. 60 min en vivo.',
    ),
  );

  // -------------------------------------------------------------------------
  section('Promociones y sus fronteras');
  // -------------------------------------------------------------------------

  // Publicidad de tienda que antes caia en General.
  check(
    'merchandising deportivo -> PROMO',
    classifyCase(
      'newsletter@fans.williamsf1.com',
      'Nueva coleccion 2026 con 20% de descuento',
      'Ver la coleccion completa. Envio gratis en pedidos superiores a 50 EUR.',
    ) === 'PROMO',
    classifyCase(
      'newsletter@fans.williamsf1.com',
      'Nueva coleccion 2026 con 20% de descuento',
      'Ver la coleccion completa. Envio gratis en pedidos superiores a 50 EUR.',
    ),
  );
  check(
    'credito preaprobado -> PROMO',
    classifyCase(
      'rappicard@hello.rappicard.co',
      'Descubre tu cupo preaprobado',
      'Pide tu tarjeta y disfruta cashback. Aplican terminos y condiciones.',
    ) === 'PROMO',
  );

  // Fronteras: Promociones tiene la prioridad mas baja y no debe robar correos
  // que pertenecen a una categoria con mas peso, aunque mencionen descuentos.
  check(
    'una factura con descuento sigue siendo FINANCE',
    classifyCase(
      'facturacion@clarocolombia.com',
      'Tu factura de agosto ya esta lista',
      'Valor total a pagar: $89.900 COP. Fecha de vencimiento: 05/09/2026. Incluye 10% de descuento por pago anticipado.',
    ) === 'FINANCE',
    classifyCase(
      'facturacion@clarocolombia.com',
      'Tu factura de agosto ya esta lista',
      'Valor total a pagar: $89.900 COP. Fecha de vencimiento: 05/09/2026. Incluye 10% de descuento por pago anticipado.',
    ),
  );
  check(
    'un curso con descuento sigue siendo INTERESTING',
    classifyCase(
      'hola@platzi.com',
      'Nuevo curso: Arquitectura de Software con Next.js',
      'Aprenderas patrones de diseno, App Router y despliegue. Duracion 12 horas, incluye certificacion.',
    ) === 'INTERESTING',
    classifyCase(
      'hola@platzi.com',
      'Nuevo curso: Arquitectura de Software con Next.js',
      'Aprenderas patrones de diseno, App Router y despliegue. Duracion 12 horas, incluye certificacion.',
    ),
  );
  check(
    'un webinar gratuito no es publicidad',
    classifyCase(
      'aws-marketing@amazon.com',
      'Te invitamos: Webinar gratuito sobre Serverless en LATAM',
      'Registrate en nuestro webinar. Ponentes: arquitectos de soluciones. Costo: gratuito.',
    ) === 'INTERESTING',
    classifyCase(
      'aws-marketing@amazon.com',
      'Te invitamos: Webinar gratuito sobre Serverless en LATAM',
      'Registrate en nuestro webinar. Ponentes: arquitectos de soluciones. Costo: gratuito.',
    ),
  );
  check(
    'un correo personal no es publicidad',
    classifyCase(
      'carlos.mesa@gmail.com',
      'Re: fotos del fin de semana',
      'Hola Juan, te comparto las fotos del paseo. Quedaron muy buenas.',
    ) === 'GENERAL',
  );

  // Una invitacion de LinkedIn arrastra el titular profesional de quien invita.
  // Si esa persona trabaja en retail, el cuerpo se llena de vocabulario
  // comercial que no dice nada del correo en si.
  check(
    'una invitacion de LinkedIn no es publicidad',
    classifyCase(
      'invitations@linkedin.com',
      'Te he enviado una solicitud de contacto',
      'Andres Felipe, Gerente de tienda en Falabella retail, esta esperando tu respuesta.',
    ) !== 'PROMO',
    classifyCase(
      'invitations@linkedin.com',
      'Te he enviado una solicitud de contacto',
      'Andres Felipe, Gerente de tienda en Falabella retail, esta esperando tu respuesta.',
    ),
  );

  // Los clubes y las aerolineas mandan contenido y avisos, no solo catalogo.
  check(
    'la cronica de un partido no es publicidad',
    classifyCase(
      'realmadridcf@madridista-premium.realmadrid.com',
      '4-1: El Madrid golea con un hat-trick de Mbappe',
      'Madridistas Premium. Cronica del partido y lo mas destacado de la jornada.',
    ) !== 'PROMO',
    classifyCase(
      'realmadridcf@madridista-premium.realmadrid.com',
      '4-1: El Madrid golea con un hat-trick de Mbappe',
      'Madridistas Premium. Cronica del partido y lo mas destacado de la jornada.',
    ),
  );
  check(
    'un aviso operativo de aerolinea no es publicidad',
    classifyCase(
      'milesandsmiles@milesandsmiles.turkishairlines.com',
      'Information Regarding Asiana Airlines Flights',
      'Please be informed about changes to the codeshare agreement affecting some routes.',
    ) !== 'PROMO',
    classifyCase(
      'milesandsmiles@milesandsmiles.turkishairlines.com',
      'Information Regarding Asiana Airlines Flights',
      'Please be informed about changes to the codeshare agreement affecting some routes.',
    ),
  );
  check(
    'pero una oferta de viaje si lo es',
    classifyCase(
      'at@news.lastminute.com',
      'Dein Urlaub ab 280 EUR - jetzt mit unseren Last Minute Deals',
      'Jetzt sichern und sparen. Angebote nur fuer kurze Zeit.',
    ) === 'PROMO',
    classifyCase(
      'at@news.lastminute.com',
      'Dein Urlaub ab 280 EUR - jetzt mit unseren Last Minute Deals',
      'Jetzt sichern und sparen. Angebote nur fuer kurze Zeit.',
    ),
  );

  // -------------------------------------------------------------------------
  section('Identificadores de Gmail por IMAP');
  // -------------------------------------------------------------------------
  const { toGmailHexId, toGmailDecimalId } = await import('../src/lib/gmail/imap');

  // IMAP entrega X-GM-MSGID en decimal; la URL de Gmail usa el hexadecimal.
  // Que la conversion coincida es lo que evita duplicar los correos que ya
  // estaban en cache con el id que dio la exportacion.
  const realHex = '1a043b08aed7d402';
  const realDec = '1874688253372126210';
  check('decimal -> hexadecimal', toGmailHexId(realDec) === realHex, String(toGmailHexId(realDec)));
  check('hexadecimal -> decimal', toGmailDecimalId(realHex) === realDec, String(toGmailDecimalId(realHex)));
  check(
    'la conversion es reversible',
    toGmailHexId(toGmailDecimalId(realHex)!) === realHex,
  );
  check('sin id devuelve null', toGmailHexId(undefined) === null);
  check('id no numerico devuelve null', toGmailHexId('no-es-un-id') === null);

  // -------------------------------------------------------------------------
  section('Saneado de caracteres invisibles');
  // -------------------------------------------------------------------------
  const { stripInvisible, toSingleLine } = await import('../src/lib/gmail/sanitize');
  const padded = `Oferta especial͏͏͏​​   de la semana­`;
  check('quita el relleno de los boletines', stripInvisible(padded) === 'Oferta especial de la semana', stripInvisible(padded));
  check('recorta el snippet', toSingleLine('a'.repeat(400)).length === 220);

  // -------------------------------------------------------------------------
  section('Ciclo completo sobre SQLite');
  // -------------------------------------------------------------------------
  const { runSync } = await import('../src/lib/sync');
  const { listEmails, getStats, getEmail } = await import('../src/lib/repository');
  const { markEmailAsRead, trashEmail } = await import('../src/lib/sync');
  const { closeDb } = await import('../src/lib/db');

  const sync = await runSync({ mode: 'demo' });
  check('la sincronizacion trae correos', sync.fetched === messages.length, String(sync.fetched));
  check('la sincronizacion no omite nada', sync.skipped === 0, String(sync.skipped));

  const stored = listEmails({ limit: 500 });
  check('quedaron guardados en SQLite', stored.length === messages.length, String(stored.length));

  const stats = getStats();
  check('las estadisticas cuadran', stats.total === stored.length, `${stats.total} vs ${stored.length}`);
  check('hay sello de ultima sincronizacion', stats.lastSyncAt !== null, String(stats.lastSyncAt));

  const target = stored.find((e) => !e.isRead);
  if (target) {
    await markEmailAsRead(target.id, true);
    check('marcar como leido persiste', getEmail(target.id)?.isRead === true);

    await markEmailAsRead(target.id, false);
    check('desmarcar tambien persiste', getEmail(target.id)?.isRead === false);
  } else {
    check('habia al menos un correo sin leer', false);
  }

  const doomed = stored[stored.length - 1];
  await trashEmail(doomed.id);
  check('mover a papelera borra del cache', getEmail(doomed.id) === null);

  // La sincronizacion es idempotente: repetirla no debe duplicar filas.
  const second = await runSync({ mode: 'demo' });
  check('segunda sync no duplica', listEmails({ limit: 500 }).length === messages.length, String(second.inserted));

  closeDb();

  // -------------------------------------------------------------------------
  console.log(`\n${'-'.repeat(58)}`);
  console.log(`Resultado: ${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) {
    console.log(`Fallos: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('Todo en orden.\n');
  process.exit(0);
}

void main();
