import type { RawMessage } from '@/lib/gmail/types';

/**
 * Set de demostracion.
 *
 * Sirve para dos cosas: que el dashboard se pueda abrir sin configurar OAuth, y
 * como banco de pruebas del clasificador (hay al menos un caso por categoria,
 * incluidos los que exigen extraccion de monto, fecha y numero de guia).
 */

interface DemoSeed {
  id: string;
  hoursAgo: number;
  from: string;
  subject: string;
  body: string;
  isRead?: boolean;
}

const SEEDS: DemoSeed[] = [
  // --- Empleo -------------------------------------------------------------
  {
    id: 'demo-job-01',
    hoursAgo: 3,
    from: '"LinkedIn Job Alerts" <jobalerts-noreply@linkedin.com>',
    subject: '8 nuevas vacantes de Full Stack Developer en Bogota',
    body: `Hola Juan Diego,

Encontramos nuevas ofertas que coinciden con tu perfil:

1. Full Stack Developer - Globant - Bogota (Hibrido)
   Salario: $6.500.000 - $9.000.000 COP
   Requisitos: React, Node.js, TypeScript, 2+ anos de experiencia

2. Semi Senior Backend Engineer - Rappi - Remoto
   Modalidad remota, tiempo completo

Ver todas las vacantes en LinkedIn.

Darse de baja de estas alertas.`,
  },
  {
    id: 'demo-job-02',
    hoursAgo: 26,
    from: '"Talento Bancolombia" <seleccion@bancolombia.com.co>',
    subject: 'Convocatoria practicas profesionales 2026-2 | Ingenieria de Sistemas',
    body: `Estimado estudiante,

Abrimos la convocatoria para practica profesional en el area de Tecnologia.

Perfil: estudiantes de Ingenieria de Sistemas, Informatica o afines que inicien
practica en el semestre 2026-2.
Responsabilidades: apoyo al equipo de desarrollo backend, automatizacion de pruebas.
Modalidad hibrida en Medellin. Apoyo de sostenimiento: $1.423.500 COP mensuales.

El cierre de inscripciones es el 15 de septiembre de 2026.

Postulate adjuntando tu hoja de vida.`,
  },
  {
    id: 'demo-job-03',
    hoursAgo: 50,
    from: '"Ana Restrepo | Recruiter" <ana.restrepo@magneto365.com>',
    subject: 'Proceso de seleccion - Desarrollador Frontend | Siguiente paso: prueba tecnica',
    body: `Hola Juan Diego,

Gracias por postularte a la vacante de Desarrollador Frontend.
Avanzaste a la siguiente etapa del proceso de seleccion.

El siguiente paso es una prueba tecnica que debes completar antes del 05/09/2026.
Te enviaremos el enlace apenas confirmes tu disponibilidad.

Quedo atenta a tu respuesta.`,
  },

  // --- Urgente ------------------------------------------------------------
  {
    id: 'demo-urgent-01',
    hoursAgo: 1,
    from: '"Google" <no-reply@accounts.google.com>',
    subject: 'Alerta de seguridad: nuevo inicio de sesion en tu cuenta',
    body: `Se detecto un nuevo inicio de sesion en tu cuenta de Google.

Dispositivo: Windows
Ubicacion aproximada: Bogota, Colombia

Si fuiste tu, puedes ignorar este mensaje. Si no reconoces esta actividad,
revisa la actividad sospechosa y cambia tu contrasena de inmediato.`,
  },
  {
    id: 'demo-urgent-02',
    hoursAgo: 8,
    from: '"Universidad de La Sabana" <registro.academico@unisabana.edu.co>',
    subject: 'ACCION REQUERIDA: confirma tu matricula antes del 30 de agosto',
    body: `Estimado estudiante,

Tu inscripcion de asignaturas para el periodo 2026-2 esta pendiente de confirmacion.

Debes confirmar tu matricula antes del 30 de agosto de 2026. Si no lo haces,
tu cupo sera cancelado y las asignaturas quedaran liberadas.

Ingresa al portal academico para completar el proceso.`,
  },
  {
    id: 'demo-urgent-03',
    hoursAgo: 20,
    from: '"Netflix" <info@mailer.netflix.com>',
    subject: 'Ultimo aviso: tu pago fue rechazado',
    body: `Hola,

No pudimos procesar el pago de tu suscripcion. Tu metodo de pago fue rechazado.

Actualiza tu informacion de pago dentro de las proximas 48 horas o tu cuenta
sera suspendida automaticamente.

Valor pendiente: $44.900 COP`,
  },

  // --- Finanzas -----------------------------------------------------------
  {
    id: 'demo-finance-01',
    hoursAgo: 5,
    from: '"Bancolombia" <alertasynotificaciones@bancolombia.com.co>',
    subject: 'Extracto de tu Tarjeta de Credito - Corte agosto 2026',
    body: `Hola Juan Diego,

Ya esta disponible el extracto de tu tarjeta de credito terminada en 4821.

Total a pagar: $487.350 COP
Pago minimo: $58.900 COP
Fecha de corte: 20/08/2026
Fecha limite de pago: 10/09/2026

Puedes pagar desde la Sucursal Virtual Personas o con PSE.`,
  },
  {
    id: 'demo-finance-02',
    hoursAgo: 11,
    from: '"Servientrega" <notificaciones@servientrega.com>',
    subject: 'Tu envio esta en camino - Guia 2104558873',
    body: `Tu paquete fue recogido y esta en transito.

Numero de guia: 2104558873
Transportadora: Servientrega
Estado: En transito
Destino: Bogota D.C.
Fecha estimada de entrega: 29 de agosto de 2026

Puedes rastrear tu envio con el numero de guia en nuestro portal.`,
  },
  {
    id: 'demo-finance-03',
    hoursAgo: 30,
    from: '"Amazon.com" <auto-confirm@amazon.com>',
    subject: 'Your Amazon.com order has shipped',
    body: `Hello Juan,

Your order has shipped and is on the way.

Order Total: USD 129.99
Payment method: Visa ending in 7742
Carrier: UPS
Tracking number: 1Z999AA10123456784
Estimated delivery: September 2, 2026

Track your package for the latest updates.`,
    isRead: true,
  },
  {
    id: 'demo-finance-04',
    hoursAgo: 47,
    from: '"Claro Colombia" <facturacion@clarocolombia.com>',
    subject: 'Tu factura de agosto ya esta lista',
    body: `Hola,

Ya generamos tu factura del mes de agosto.

Numero de factura: FE-8842019
Valor total a pagar: $89.900 COP
Fecha de vencimiento: 05/09/2026

Recuerda que si pagas despues de la fecha de vencimiento se genera un cargo por mora.`,
  },
  {
    id: 'demo-finance-05',
    hoursAgo: 72,
    from: '"Nequi" <notificaciones@nequi.com.co>',
    subject: 'Confirmacion de transferencia por $150.000',
    body: `Hiciste una transferencia desde tu Nequi.

Valor: $150.000 COP
Fecha: 24/08/2026
Destino: cuenta terminada en 3390
Estado: Exitosa`,
    isRead: true,
  },

  // --- Noticias -----------------------------------------------------------
  {
    id: 'demo-news-01',
    hoursAgo: 6,
    from: '"TLDR Newsletter" <dan@tldrnewsletter.com>',
    subject: 'TLDR: El nuevo modelo de razonamiento, Rust en el kernel y mas',
    body: `TLDR - Tu resumen diario de tecnologia

EN ESTA EDICION
- Nuevo modelo de razonamiento supera benchmarks de programacion
- El kernel de Linux amplia el soporte de Rust
- Ronda de inversion de $200M USD para una startup de infraestructura

5 min de lectura

Darse de baja | Ver en el navegador`,
  },
  {
    id: 'demo-news-02',
    hoursAgo: 27,
    from: '"The Verge" <newsletter@theverge.com>',
    subject: 'Installer #92: lo mas destacado de la semana en tecnologia',
    body: `Esta semana en tecnologia:

Titulares principales, resenas de dispositivos y las apps que vale la pena probar.

Cancelar suscripcion | Preferencias de correo`,
    isRead: true,
  },
  {
    id: 'demo-news-03',
    hoursAgo: 54,
    from: '"La Republica" <boletin@larepublica.com.co>',
    subject: 'Boletin economico: cierre de los mercados',
    body: `Resumen diario de los mercados.

El dolar cerro a $3.985 COP. El indice MSCI Colcap registro variacion positiva.

Ver todas las noticias. Darse de baja.`,
    isRead: true,
  },

  // --- Interesantes -------------------------------------------------------
  {
    id: 'demo-interesting-01',
    hoursAgo: 14,
    from: '"Platzi" <hola@platzi.com>',
    subject: 'Nuevo curso: Arquitectura de Software con Next.js',
    body: `Hola Juan Diego,

Lanzamos el curso de Arquitectura de Software moderna.

Aprenderas patrones de diseno, App Router, server components y despliegue.
Duracion: 12 horas. Incluye certificacion.

Cupos limitados para la primera cohorte.`,
  },
  {
    id: 'demo-interesting-02',
    hoursAgo: 35,
    from: '"AWS Events" <aws-marketing@amazon.com>',
    subject: 'Te invitamos: Webinar gratuito sobre Serverless en LATAM',
    body: `Registrate en nuestro webinar sobre arquitecturas serverless.

Fecha: 10 de septiembre de 2026
Hora: 10:00 AM (GMT-5)
Ponentes: arquitectos de soluciones de AWS
Costo: gratuito

Reserva tu lugar, los cupos son limitados.`,
  },
  {
    id: 'demo-interesting-03',
    hoursAgo: 60,
    from: '"GitHub" <noreply@github.com>',
    subject: 'Guia: como estructurar monorepos a escala',
    body: `Publicamos una guia paso a paso sobre estructuras de monorepo.

Incluye casos de estudio de equipos grandes y herramientas recomendadas.

8 min de lectura`,
    isRead: true,
  },

  // --- General ------------------------------------------------------------
  {
    id: 'demo-general-01',
    hoursAgo: 18,
    from: '"Carlos Mesa" <carlos.mesa@gmail.com>',
    subject: 'Re: fotos del fin de semana',
    body: `Hola Juan,

Te comparto las fotos del paseo. Quedaron muy buenas.

Nos hablamos.`,
  },
  {
    id: 'demo-general-02',
    hoursAgo: 40,
    from: '"Spotify" <no-reply@spotify.com>',
    subject: 'Tu resumen de escucha de esta semana',
    body: `Estos fueron tus artistas mas escuchados en la semana.

Descubre tu mix personalizado.`,
    isRead: true,
  },
];

function parseFrom(raw: string): { name: string; email: string } {
  const match = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (!match) return { name: raw, email: raw };
  return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
}

/** Genera los mensajes con fechas relativas a ahora, para que el dashboard luzca vigente. */
export function buildDemoMessages(reference: Date = new Date()): RawMessage[] {
  return SEEDS.map((seed) => {
    const { name, email } = parseFrom(seed.from);
    const date = new Date(reference.getTime() - seed.hoursAgo * 3600_000);
    const body = seed.body.trim();

    return {
      id: seed.id,
      threadId: `${seed.id}-thread`,
      senderName: name,
      senderEmail: email,
      subject: seed.subject,
      dateReceived: date.toISOString(),
      snippet: body.replace(/\s+/g, ' ').slice(0, 180),
      body,
      isRead: seed.isRead ?? false,
      labels: seed.isRead ? ['INBOX'] : ['INBOX', 'UNREAD'],
    } satisfies RawMessage;
  });
}
