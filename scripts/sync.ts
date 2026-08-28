import fs from 'node:fs';
import path from 'node:path';
import { hasFlag, loadEnv, readFlag } from './_env';

loadEnv();

/**
 * Con `--log`, todo lo que se imprima se duplica en `logs/sync.log`.
 *
 * Lo hace el script y no una redireccion del sistema porque el Programador de
 * tareas de Windows invoca a traves de `cmd /c`, que destroza las comillas
 * cuando la orden empieza por una: la redireccion se perdia y no se escribia
 * nada. Escribiendo el archivo desde aqui, la tarea puede llamar a node
 * directamente y no depende del shell.
 */
function enableFileLog(): void {
  const logDir = path.join(process.cwd(), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'sync.log');

  // Escritura sincrona a proposito: el script termina con process.exit(), que
  // no espera a que un stream asincrono vacie su buffer. Con createWriteStream
  // el log se cortaba a media ejecucion. Son unas pocas lineas al dia.
  const forward =
    (original: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      try {
        fs.appendFileSync(logFile, `${new Date().toISOString()} ${args.join(' ')}\n`);
      } catch {
        // Un fallo al escribir el log no debe abortar la sincronizacion.
      }
      original(...args);
    };

  console.log = forward(console.log.bind(console));
  console.warn = forward(console.warn.bind(console));
  console.error = forward(console.error.bind(console));
}

if (hasFlag('log')) enableFileLog();

/**
 * Sincronizacion por linea de comandos.
 *
 * Es el mismo motor que usa `POST /api/sync`, pero sin pasar por HTTP: asi el
 * cron diario funciona aunque el servidor de Next no este levantado.
 *
 *   npm run sync                      -> usa la fuente configurada en .env
 *   npm run sync -- --mode demo       -> fuerza los datos de demostracion
 *   npm run sync -- --query "is:unread newer_than:7d" --max 50
 */
async function main() {
  // El import va aqui, despues de loadEnv(), porque los modulos leen process.env al cargarse.
  const { runSync } = await import('../src/lib/sync');
  const { closeDb } = await import('../src/lib/db');

  const mode = readFlag('mode') as 'gmail' | 'bridge' | 'demo' | undefined;
  const query = readFlag('query');
  const maxRaw = readFlag('max');
  const maxResults = maxRaw ? Number.parseInt(maxRaw, 10) : undefined;

  const startedAt = new Date();
  console.log(`[sync] inicio ${startedAt.toISOString()}`);

  try {
    const result = await runSync({ mode, query, maxResults });

    console.log(`[sync] fuente        : ${result.source}`);
    console.log(`[sync] traidos       : ${result.fetched}`);
    console.log(`[sync] nuevos        : ${result.inserted}`);
    console.log(`[sync] actualizados  : ${result.updated}`);
    console.log(`[sync] omitidos      : ${result.skipped}`);
    console.log(`[sync] duracion      : ${result.durationMs} ms`);

    for (const warning of result.errors) console.warn(`[sync] aviso: ${warning}`);

    console.log('[sync] ok');
    closeDb();
    process.exit(0);
  } catch (error) {
    console.error(`[sync] ERROR: ${error instanceof Error ? error.message : String(error)}`);
    closeDb();
    process.exit(1);
  }
}

void main();
