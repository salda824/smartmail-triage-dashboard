# SmartMail Triage

Dashboard de triaje de correo: sincroniza Gmail, clasifica cada mensaje en seis
categorías, extrae los datos que importan (montos, fechas límite, guías de
envío, motivo de urgencia) y deja actuar sobre ellos sin salir del panel.

Todo corre en local. Los correos se cachean en SQLite para no repetir llamadas a
la API de Gmail.

---

## Índice

- [Stack](#stack)
- [Puesta en marcha](#puesta-en-marcha)
- [Conectar Gmail](#conectar-gmail)
  - [Opción A — IMAP](#opción-a--imap-con-contraseña-de-aplicación)
  - [Opción B — Gmail API](#opción-b--gmail-api-con-oauth)
- [Orígenes de datos](#orígenes-de-datos)
- [Categorías y clasificación](#categorías-y-clasificación)
- [Extracción de metadatos](#extracción-de-metadatos)
- [Base de datos](#base-de-datos)
- [API](#api)
- [Sincronización programada](#sincronización-programada)
- [Comandos](#comandos)
- [Estructura](#estructura)
- [Privacidad](#privacidad)

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 |
| Lenguaje | TypeScript (modo estricto) |
| Estilos | Tailwind CSS 3 con paleta propia |
| Iconos | `lucide-react` |
| Base de datos | SQLite vía `better-sqlite3` |
| Gmail | `imapflow` + `mailparser` (IMAP) o `googleapis` (Gmail API v1) |
| Scripts | `tsx` |

---

## Puesta en marcha

Requiere Node.js 20 o superior.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run seed
```

```bash
npm run dev
```

Abre <http://localhost:3000>.

`npm run seed` llena la base con un set de demostración de 19 correos que cubre
las seis categorías. Sirve para ver el dashboard funcionando antes de conectar
Gmail.

---

## Conectar Gmail

Hay dos caminos. **IMAP es el recomendado**: no necesita proyecto en Google
Cloud ni pantalla de consentimiento, y la credencial no caduca sola.

| | IMAP + contraseña de aplicación | Gmail API + OAuth |
| --- | --- | --- |
| Configuración | 3 pasos, ~5 min | Proyecto en Cloud, ~20 min |
| Caducidad | No caduca | El refresh token caduca a los 7 días en modo *Testing* |
| Alcance | Acceso completo al buzón | Solo los permisos concedidos |
| Costo | Gratis | Gratis |

Ambos leen y escriben (marcar leído, mover a papelera). Ninguno borra de forma
permanente.

---

## Opción A — IMAP con contraseña de aplicación

### 1. Activa la verificación en dos pasos

Las contraseñas de aplicación solo existen si está activa:
<https://myaccount.google.com/signinoptions/two-step-verification>

### 2. Crea la contraseña de aplicación

<https://myaccount.google.com/apppasswords> — nómbrala `SmartMail Triage`.
Google te dará 16 caracteres en cuatro grupos.

### 3. Comprueba que IMAP esté habilitado

Gmail → Ver todos los ajustes → Reenvío y correo POP/IMAP → Habilitar IMAP.

### 4. Configura y prueba

En `.env.local`:

```
MAIL_SOURCE=imap
IMAP_USER=tu.correo@gmail.com
IMAP_APP_PASSWORD=abcd efgh ijkl mnop
```

Los espacios se limpian solos, puedes pegarla tal cual.

```bash
npm run imap:test
```

Ese comando solo lee: conecta, cuenta los mensajes de la bandeja y muestra los
cinco más recientes para confirmar que las credenciales y el parseo funcionan.
Si pasa, ya puedes sincronizar con `npm run sync`.

### Detalles de la implementación

- **Los identificadores coinciden con los de la Gmail API.** IMAP entrega
  `X-GM-MSGID` en decimal; la interfaz web de Gmail usa su forma hexadecimal en
  la URL. La app convierte entre las dos, así que el enlace *Abrir en Gmail*
  funciona igual y los correos que ya estaban en caché se reconocen en lugar de
  duplicarse si cambias de origen.
- **La papelera se busca por su marca especial**, no por nombre: en una cuenta
  en español la carpeta se llama `[Gmail]/Papelera`, y en inglés
  `[Gmail]/Trash`.
- **Los mensajes se mueven, nunca se marcan `\Deleted` + `EXPUNGE`**, para que
  sigan siendo recuperables desde la papelera durante 30 días.
- El registro de `imapflow` está desactivado: si no, escribiría cada comando
  IMAP por consola, asuntos y remitentes incluidos.

⚠️ Una contraseña de aplicación da **acceso completo al buzón**. Vive solo en
`.env.local`, que está en `.gitignore`. Puedes revocarla en cualquier momento
desde la misma página donde la creaste.

---

## Opción B — Gmail API con OAuth

### 1. Credenciales de Google

1. Entra a <https://console.cloud.google.com> y crea un proyecto.
2. Habilita la **Gmail API** (APIs y servicios → Biblioteca).
3. Configura la pantalla de consentimiento OAuth como **Externa** y agrega tu
   propia cuenta en *Usuarios de prueba*.
4. Crea credenciales OAuth de tipo **Aplicación de escritorio**.
5. Copia el *Client ID* y el *Client secret* a `.env.local`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 2. Autorizar

```bash
npm run gmail:auth
```

El script imprime una URL. La abres en tu navegador, autorizas y pegas de vuelta
el código que te da Google. El *refresh token* se guarda en `.gmail-token.json`
y se imprime para que lo copies a `.env.local`:

```
GOOGLE_REFRESH_TOKEN=...
MAIL_SOURCE=gmail
```

### 3. Sincronizar

```bash
npm run sync
```

O pulsa **Sincronizar Ahora** en el dashboard.

Los permisos solicitados son `gmail.readonly` y `gmail.modify`. El segundo hace
falta para marcar como leído y mover a la papelera. La app **nunca** borra de
forma permanente: usa `messages.trash`, reversible desde Gmail durante 30 días.

---

## Orígenes de datos

`MAIL_SOURCE` en `.env.local` decide de dónde salen los correos. Los tres
orígenes implementan la misma interfaz (`src/lib/gmail/types.ts`), así que el
resto de la app no cambia.

| Modo | Qué hace | Escribe en Gmail |
| --- | --- | --- |
| `imap` | IMAP con contraseña de aplicación | Sí |
| `gmail` | Gmail API vía OAuth | Sí |
| `bridge` | Lee un JSON de disco (`BRIDGE_INBOX_PATH`) | No |
| `demo` | Set de ejemplo incluido | No |

Sin `MAIL_SOURCE` definido, la app elige según las credenciales que encuentre:
`imap` si hay contraseña de aplicación, `gmail` si hay refresh token, y `demo`
si no hay ninguna. Si el modo pedido está mal configurado, cae a `demo` con un
aviso visible en el dashboard en lugar de mostrar una pantalla de error.

### Modo `bridge`

Pensado para cuando los correos se obtienen por fuera de la app (una exportación
manual, o herramientas de Gmail del entorno) y solo hace falta clasificarlos.
El archivo puede ser un arreglo suelto o `{ "messages": [...] }`, y tolera
`snake_case`, `camelCase` y el formato de la Gmail API:

```json
[
  {
    "id": "18f2c9a1b3",
    "threadId": "18f2c9a1b3",
    "from": "\"Bancolombia\" <alertas@bancolombia.com.co>",
    "subject": "Extracto de tu tarjeta",
    "date": "2026-08-27T10:30:00Z",
    "body": "Total a pagar: $487.350 COP...",
    "isRead": false
  }
]
```

---

## Categorías y clasificación

| | Categoría | Qué recoge |
| --- | --- | --- |
| 💼 | **Ofertas de Empleo** | Vacantes, prácticas, procesos de selección, alertas de portales. Va **fija en primera posición** por ser la de mayor prioridad. |
| 🚨 | **Urgente** | Acción requerida, plazos inminentes, alertas de seguridad, pagos rechazados. |
| 💳 | **Pagos y Envíos** | Facturas, extractos, compras, suscripciones, guías de paquetería. |
| 📰 | **Noticias** | Newsletters y boletines. |
| 💡 | **Interesantes** | Cursos, webinars, guías largas, eventos. |
| 🏷️ | **Promociones** | Descuentos, ofertas, catálogos y marketing de tiendas. |
| 📦 | **General** | Lo que no encaja en las anteriores. |

> **Promociones no estaba en el diseño original.** Se añadió después de medir
> una bandeja real: el 68% de los correos caía en *General*, casi todos
> publicidad de retail, y el panel apenas hacía triaje.

Reparto sobre 90 correos reales, antes y después de añadir *Promociones* y el
rescate de boletines:

| Categoría | Antes | Después |
| --- | ---: | ---: |
| General | 61 (68%) | **30 (33%)** |
| Promociones | — | 20 |
| Ofertas de Empleo | 13 | 14 |
| Urgente | 11 | 11 |
| Noticias | 0 | 10 |
| Pagos y Envíos | 4 | 4 |
| Interesantes | 1 | 1 |

### Cómo decide

El motor (`src/lib/classifier/`) puntúa cada categoría con señales ponderadas y
se queda con la de mayor puntaje:

- **Remitente** — peso completo. Un correo de `linkedin.com` es una oferta
  laboral casi con independencia del cuerpo.
- **Asunto** — peso completo.
- **Cuerpo** — mitad de peso. El cuerpo confirma, no decide.
- **Bono de coherencia** — +2 si asunto y cuerpo apuntan a la misma categoría.
- **Umbral** — por debajo de 5 puntos el correo cae en `GENERAL` en vez de
  forzar una categoría dudosa.
- **Desempate** — por `priority`. Un correo que es factura *y* urgente se
  muestra como urgente, porque es la acción que no puede esperar.

### Señales negativas

Tres reglas anulan una categoría en vez de sumar a otra. Todas salieron de
falsos positivos observados en correo real:

- **Remitente automático → menos `URGENT`.** El correo masivo desde `no-reply@`
  no suele exigir acción. Pero la penalización **solo se aplica si el asunto no
  disparó ninguna señal de urgencia**: una alerta de seguridad real también
  llega desde un `no-reply`, y castigarla la escondía.
- **Buzón social → nunca `PROMO`.** Una invitación de LinkedIn arrastra el
  titular profesional de quien invita; si esa persona trabaja en retail, el
  cuerpo se llena de vocabulario comercial que no dice nada del correo.
- **Contenido u aviso operativo → nunca `PROMO`.** Una tienda, un club o una
  aerolínea no solo venden: informan del resultado de un partido o de un cambio
  de vuelo. Sin esta regla, «4-1: El Madrid golea» e «Information Regarding
  Asiana Flights» acababan etiquetados como publicidad.

La alternativa a la última —bajar el peso de esos remitentes— se probó y se
descartó: arreglaba 3 falsos positivos pero perdía 10 aciertos. Una señal
negativa precisa cuesta menos que una rebaja general.

### Rescate de boletines

Los boletines editoriales llegan con titulares de gancho —«eight tickers, one
bet», «i was waiting to feel ready»— que no contienen ninguna palabra clave.
Ninguna regla los alcanzaba y caían todos en *General*.

Lo único que comparten es el pie de baja, pero ese pie también lo llevan los
catálogos. De ahí una regla **por descarte**, que se aplica al final: si el
mejor candidato fue `NEWS` y se quedó corto, el correo llega en lote, tiene
cuerpo suficiente para ser una lectura, y **no** viene de una red social ni de
un buzón de cuenta ni es un aviso operativo — entonces es un boletín.

Estos correos se marcan con confianza 0,45: se dedujeron por descarte, no por
evidencia positiva, y la tarjeta debe decirlo.

Afinar esta regla costó dos intentos. Exigir «ninguna señal en absoluto»
dejaba fuera justo a los boletines, que rondan los 4 puntos por hablar de
mercados. La condición correcta no es la ausencia de señal, sino que la señal
que hubo apuntara a `NEWS`.

### Idiomas

Español e inglés. El motor no cubre otros idiomas a propósito.

---

## Extracción de metadatos

Solo se extrae lo que la categoría va a mostrar. Cuando no hay señal clara se
devuelve `undefined`: preferimos un campo ausente a un dato inventado.

**Montos.** Distingue el formato colombiano/europeo (`1.234.567,89`) del
estadounidense (`1,234,567.89`) mirando cuál separador aparece último. Un número
sin símbolo ni sufijo de moneda no cuenta como dinero. Entre varios candidatos
gana el que tenga contexto monetario cerca (*total*, *valor*, *a pagar*); si
ninguno lo tiene, gana el mayor — normalmente el total del recibo.

**Fechas límite.** ISO, `dd/mm/aaaa`, textual en español e inglés, y relativas
(`dentro de las próximas 48 horas`). Se prefiere la fecha que esté junto a una
palabra de plazo, luego las futuras sobre las pasadas. Sin año explícito, elige
el que deje la fecha más cerca del correo.

**Guías de envío.** Etiquetadas (`número de guía: …`) o por formato conocido
(UPS `1Z…`, FedEx, postal internacional). Sin contexto de envío no extrae nada,
para no confundir un código postal con una guía.

**Transportadoras.** Servientrega, Coordinadora, Interrapidísimo, TCC, Deprisa,
4-72, DHL, FedEx, UPS, USPS y otras.

**Urgencia.** Motivo en una línea y acción recomendada, de una lista ordenada de
la regla más específica a la más genérica.

Las tarjetas de finanzas distinguen un envío de un cobro: si hay guía o
transportadora, la fecha se rotula *Entrega estimada* en lugar de *Vencimiento*.

---

## Base de datos

SQLite en `data/smartmail.db` (configurable con `SMARTMAIL_DB_PATH`). El esquema
vive en [`src/lib/schema.sql`](src/lib/schema.sql) y se aplica solo al abrir la
conexión.

```sql
emails (
  id             TEXT PRIMARY KEY,   -- Gmail message ID
  thread_id      TEXT,
  sender_name    TEXT,
  sender_email   TEXT,
  subject        TEXT,
  date_received  TEXT,               -- ISO 8601
  snippet        TEXT,
  body_preview   TEXT,
  category       TEXT,               -- JOB|URGENT|FINANCE|NEWS|INTERESTING|PROMO|GENERAL
  confidence     REAL,
  extracted_data TEXT,               -- JSON
  is_read        INTEGER,
  is_archived    INTEGER,
  created_at     TEXT,
  updated_at     TEXT
)
```

Más `sync_log`, que alimenta el sello de *última sincronización*.

### Migraciones

El esquema se versiona con `PRAGMA user_version` y las migraciones viven en
[`src/lib/migrations.ts`](src/lib/migrations.ts). Hacen falta porque
`schema.sql` usa `CREATE TABLE IF NOT EXISTS`: en una base que ya existe es un
no-op, así que un cambio de esquema nunca llegaría solo.

SQLite no permite modificar una restricción `CHECK` con `ALTER TABLE`, de modo
que la migración a v2 (añadir `PROMO`) recrea la tabla y copia las filas dentro
de una transacción. Como al recrearla se pierden sus índices y su trigger, el
esquema se vuelve a aplicar justo después.

Para ver el estado:

```bash
npm run db:check
```

### Otras decisiones

- La sincronización es **idempotente**. Un `ON CONFLICT DO UPDATE` refresca
  contenido y clasificación, pero **conserva `is_archived`**: si ya archivaste
  un correo, una sincronización posterior no lo devuelve a la bandeja.
- Todo el lote se escribe en **una sola transacción**.

---

## API

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `GET` | `/api/emails` | Lista con filtros: `category`, `q`, `unread`, `archived`, `limit`, `offset`, `sort` |
| `GET` | `/api/stats` | Contadores por categoría y última sincronización |
| `POST` | `/api/sync` | Sincroniza. Body opcional: `{ maxResults, query, mode }` |
| `POST` `PATCH` | `/api/emails/[id]/read` | Marca leído/no leído. Body: `{ isRead }` |
| `DELETE` `POST` | `/api/emails/[id]/delete` | Mueve a la papelera de Gmail y quita del caché |

Las acciones escriben primero en local y después en Gmail, para que la interfaz
responda de inmediato. Si Gmail rechaza la operación, la respuesta trae un
`warning` y el cambio local se conserva.

---

## Sincronización programada

```bash
npm run cron:install
```

Registra una tarea diaria en el Programador de tareas de Windows que sincroniza
a las 08:00 y escribe en `logs/sync.log`. No necesita permisos de administrador
ni que el servidor de Next esté levantado — el script habla directamente con la
capa de datos.

Tres detalles que costaron una vuelta cada uno:

- **La tarea llama a `node.exe` por ruta absoluta**, no a `npm run sync`. El
  Programador de tareas no hereda el `PATH` de la sesión, así que `npm` no
  encontraría `node`.
- **El log lo escribe el script, no una redirección.** `cmd /c` se come las
  comillas cuando la orden empieza por una, y la redirección se perdía sin
  dejar rastro. Con `--log`, el propio script anexa a `logs/sync.log`.
- **`LogonType Interactive`, no `S4U`.** S4U permite correr sin sesión iniciada
  pero exige privilegios de administrador para registrarse. Interactive no los
  pide, a cambio de que la sincronización solo corra con la sesión abierta;
  `-StartWhenAvailable` hace que se ponga al día al volver.

Para comprobar que quedó bien:

```bash
npm run cron:install -- -Remove
```

```bash
npm run cron:install -- -Time 07:30
```

```bash
npm run cron:install -- -Remove
```

En Linux o macOS, el equivalente en crontab:

```
0 8 * * * cd /ruta/al/proyecto && npm run sync >> logs/sync.log 2>&1
```

---

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Sirve el build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | Pruebas del clasificador, extractores y ciclo completo sobre SQLite |
| `npm run seed` | Llena la base con los datos de demostración |
| `npm run reset -- --demo` | Quita del caché los correos de demostración |
| `npm run reset -- --all` | Vacía el caché por completo (no toca Gmail) |
| `npm run db:check` | Versión de esquema, integridad y reparto por categoría |
| `npm run sync` | Sincroniza con la fuente configurada |
| `npm run imap:test` | Comprueba la conexión IMAP (solo lectura) |
| `npm run gmail:auth` | Obtiene el refresh token de Gmail (opción B) |
| `npm run cron:install` | Programa la sincronización diaria |

`npm run sync` acepta banderas:

```bash
npm run sync -- --mode demo
```

```bash
npm run sync -- --query "is:unread newer_than:7d" --max 50
```

### Pruebas

```bash
npm run verify
```

90 comprobaciones: normalización de texto, parsing de montos en tres formatos,
extracción de fechas y guías, clasificación de los 19 correos de ejemplo,
enriquecimiento de tarjetas, casos de regresión tomados de correo real, y el
ciclo completo sincronizar → leer → marcar → borrar sobre una base de pruebas
aparte (`data/verify.db`, nunca la real).

Los casos de regresión documentan fallos que ya ocurrieron, para que no
vuelvan. Por ejemplo: `ups` hacía match dentro de `groups-noreply@linkedin.com`
y mandaba correo social a la categoría de transportadoras; las siglas de
transportadora ahora llevan límites de palabra.

---

## Estructura

```
src/
├── app/
│   ├── api/
│   │   ├── emails/route.ts              GET lista
│   │   ├── emails/[id]/read/route.ts     POST|PATCH marcar leído
│   │   ├── emails/[id]/delete/route.ts   DELETE papelera
│   │   ├── stats/route.ts                GET contadores
│   │   └── sync/route.ts                 POST sincronizar
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                          carga inicial desde el servidor
├── components/
│   ├── ui/                               badge, button, icon-button
│   ├── Dashboard.tsx                     estado y acciones optimistas
│   ├── TopBar.tsx                        buscador, contador, sincronizar
│   ├── CategoryTabs.tsx                  pestañas con badges
│   ├── EmailCard.tsx / EmailRow.tsx      vistas cuadrícula y lista
│   ├── EmailMetadata.tsx                 datos extraídos
│   ├── EmailActions.tsx                  leer / papelera / abrir en Gmail
│   ├── Avatar.tsx
│   └── Toast.tsx
├── lib/
│   ├── classifier/
│   │   ├── index.ts                      motor de puntuación
│   │   ├── rules.ts                      señales por categoría
│   │   └── extractors.ts                 montos, fechas, guías, urgencia
│   ├── gmail/
│   │   ├── imap.ts                       IMAP + contraseña de aplicación
│   │   ├── client.ts                     Gmail API + parsing MIME
│   │   ├── adapter.ts                    fábrica de orígenes
│   │   ├── sanitize.ts                   limpieza de texto invisible
│   │   ├── demo-data.ts
│   │   └── types.ts
│   ├── db.ts                             conexión SQLite
│   ├── repository.ts                     CRUD
│   ├── schema.sql
│   ├── sync.ts                           orquestador y acciones
│   └── utils.ts
└── types/email.ts                        modelo de dominio
scripts/
├── sync.ts                               CLI de sincronización
├── imap-test.ts                          diagnóstico de la conexión IMAP
├── gmail-auth.ts                         flujo OAuth
├── reset-db.ts                           limpieza del caché
├── verify.ts                             pruebas
└── install-cron.ps1                      tarea programada
```

### Interfaz

La app es un **armazón de altura fija**: ocupa exactamente el viewport y la
página nunca hace scroll. El desplazamiento vive dentro de cada panel.

```
┌──────────┬─────────────────────────────────────────────┐
│ Barra    │  Buscador · filtros · densidad · panel       │
│ lateral  ├──────────────────────┬──────────────────────┤
│          │                      │                      │
│ Categorías  Lista (scroll)      │  Lectura (scroll)    │
│ contadores│                     │                      │
│ Sync      │                     │                      │
│ Tema      │                     │                      │
└──────────┴──────────────────────┴──────────────────────┘
```

Hay **dos vistas**, conmutables desde la barra lateral:

- **Tarjetas** (por defecto): cuadrícula responsiva con el recuadro de datos
  extraídos teñido según la categoría, y **paginación** al pie — 6, 12, 24 o 48
  por página. Sin scroll infinito.
- **Lista**: filas compactas con panel de lectura al lado, pensada para recorrer
  la bandeja con el teclado. Dos densidades: cómoda y compacta (~16 visibles).
- **Tema claro y oscuro**, con conmutador en la barra lateral. La preferencia se
  guarda y se aplica antes de la primera pintura, así que no hay destello.

Sobre la paleta: el enunciado original pedía `#0B0F19` con acentos de neón. En
la práctica resultaba agresiva a la vista, así que se conservaron los tonos
(azul, violeta, ámbar, rojo) pero desaturados, el fondo se levantó a `#0D0E12` y
el texto se bajó a `#E3E4E8` en lugar de blanco puro.

### Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `J` / `↓` | Siguiente correo |
| `K` / `↑` | Correo anterior |
| `E` | Marcar leído / no leído |
| `#` / `Supr` | Mover a la papelera |
| `/` | Enfocar el buscador |
| `Esc` | Limpiar la búsqueda |

---

## Antivirus que inspecciona TLS

Si la sincronización falla con:

```
self-signed certificate in certificate chain
```

la causa es un antivirus con inspección de tráfico cifrado —Kaspersky, ESET,
Avast y similares—. Interceptan la conexión TLS con Gmail y la re-firman con
una raíz propia que instalan en el almacén de certificados de Windows.

Node **no** usa el almacén del sistema: trae su propia lista de autoridades, no
encuentra esa raíz y aborta.

La app lo resuelve sola. Al arrancar, tanto los scripts de CLI
([`scripts/_env.ts`](scripts/_env.ts)) como el servidor de Next
([`src/instrumentation.ts`](src/instrumentation.ts)) añaden los certificados
raíz del sistema a los que Node ya trae:

```ts
tls.setDefaultCACertificates([
  ...tls.getCACertificates('default'),
  ...tls.getCACertificates('system'),
]);
```

Se **amplía** el conjunto de autoridades de confianza con las que el sistema ya
considera válidas. En ningún momento se desactiva la verificación del
certificado — `NODE_TLS_REJECT_UNAUTHORIZED=0` sería la solución fácil y
equivocada, porque dejaría la conexión abierta a cualquier intermediario, no
solo al antivirus.

Requiere Node 22.15 o superior, que es cuando aparecen esas dos APIs. En
versiones anteriores habría que usar `NODE_EXTRA_CA_CERTS` apuntando al
certificado del antivirus.

---

## OneDrive

Si el proyecto vive dentro de una carpeta sincronizada por OneDrive, el
servidor de desarrollo falla de forma intermitente:

```
Error: EBUSY: resource busy or locked, open '.next\static\chunks\app\page.js'
```

OneDrive bloquea cada archivo mientras lo sube, y Next.js reescribe los chunks
de `.next` en cada recompilación. Los dos se pelean por el mismo archivo.

> **Aparte pero relacionado:** no ejecutes `npm run build` con `npm run dev`
> corriendo. Ambos escriben en `.next`, y el build de producción deja al
> servidor de desarrollo sirviendo un CSS vacío — la página se ve como HTML sin
> estilos. Si te pasa: para el servidor, borra `.next` y vuelve a arrancarlo.

Se probaron dos atajos y **ninguno funciona**, por si tienes la tentación:

- Mover `distDir` fuera del proyecto: Next lo resuelve contra la raíz del
  proyecto, y los chunks generados dejan de encontrar `node_modules`.
- Un junction de `.next` a otra unidad: Node resuelve la ruta real antes de
  buscar `node_modules`, con el mismo resultado.

Las soluciones que sí funcionan:

1. **Mover el proyecto fuera de OneDrive** (por ejemplo a `C:\dev\`). Es la
   recomendada, y también evita sincronizar los ~30.000 archivos de
   `node_modules`.
2. **Excluir la carpeta en OneDrive**: Configuración → Sincronización y copia de
   seguridad → Configuración avanzada → Excluir archivos.

---

## Privacidad

- La base de datos, los tokens y el `.env.local` están en `.gitignore`. **Nada
  de esto debe subirse al repositorio.**
- `data/` guarda el contenido de tus correos en texto plano, sin cifrar. Es un
  caché local: si el equipo es compartido, tenlo en cuenta.
- El refresh token de `.gmail-token.json` se escribe con permisos `600`.
- La app no envía datos a ningún servicio externo. Solo habla con la Gmail API.
- Para revocar el acceso: <https://myaccount.google.com/permissions>.
