import { hasFlag, loadEnv } from './_env';

loadEnv();

/**
 * Limpieza del cache local.
 *
 *   npm run reset -- --demo     quita solo los correos de demostracion
 *   npm run reset -- --all      vacia la tabla entera (correos y bitacora)
 *
 * No toca Gmail: solo borra el cache. Una sincronizacion posterior vuelve a
 * traer los mensajes que sigan en la bandeja.
 */
async function main() {
  const { getDb, closeDb } = await import('../src/lib/db');

  const all = hasFlag('all');
  const demo = hasFlag('demo');

  if (!all && !demo) {
    console.error('Indica que borrar: --demo (solo los de ejemplo) o --all (todo).');
    process.exit(1);
  }

  const db = getDb();
  const before = (db.prepare('SELECT COUNT(*) AS n FROM emails').get() as { n: number }).n;

  if (all) {
    const removed = db.prepare('DELETE FROM emails').run().changes;
    db.prepare('DELETE FROM sync_log').run();
    console.log(`[reset] tabla vaciada: ${removed} correos eliminados`);
  } else {
    const removed = db.prepare("DELETE FROM emails WHERE id LIKE 'demo-%'").run().changes;
    console.log(`[reset] ${removed} correos de demostracion eliminados`);
  }

  const after = (db.prepare('SELECT COUNT(*) AS n FROM emails').get() as { n: number }).n;
  console.log(`[reset] ${before} -> ${after} correos en cache`);

  closeDb();
  process.exit(0);
}

void main();
