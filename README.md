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
| Gmail | `googleapis` (Gmail API v1, OAuth 2.0) |
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
| `gmail` | Gmail API real vía OAuth | Sí |
| `bridge` | Lee un JSON de disco (`BRIDGE_INBOX_PATH`) | No |
| `demo` | Set de ejemplo incluido | No |

Sin `MAIL_SOURCE` definido, la app usa `gmail` si encuentra un refresh token y
`demo` si no. Si `gmail` está pedido pero mal configurado, cae a `demo` con un
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
| 📦 | **General** | Lo que no encaja en las anteriores. |

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

Un detalle que costó afinar: los remitentes automáticos (`no-reply@…`) reciben
una penalización en `URGENT` para que el correo masivo no se cuele ahí, **pero
solo si el asunto no disparó ninguna señal de urgencia**. Una alerta de
seguridad real también llega desde un `no-reply`, y penalizarla la escondía.

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
  category       TEXT,               -- JOB|URGENT|FINANCE|NEWS|INTERESTING|GENERAL
  confidence     REAL,
  extracted_data TEXT,               -- JSON
  is_read        INTEGER,
  is_archived    INTEGER,
  created_at     TEXT,
  updated_at     TEXT
)
```

Más `sync_log`, que alimenta el sello de *última sincronización*.

Dos decisiones que vale la pena conocer:

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

Registra una tarea diaria en el Programador de tareas de Windows que ejecuta
`npm run sync` a las 08:00 y escribe en `logs/sync.log`. No necesita permisos de
administrador ni que el servidor de Next esté levantado — el script habla
directamente con la capa de datos.

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
| `npm run sync` | Sincroniza con la fuente configurada |
| `npm run gmail:auth` | Obtiene el refresh token de Gmail |
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

66 comprobaciones: normalización de texto, parsing de montos en tres formatos,
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
│   │   ├── client.ts                     Gmail API + parsing MIME
│   │   ├── adapter.ts                    fábrica de orígenes
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
├── gmail-auth.ts                         flujo OAuth
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
