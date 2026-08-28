import { loadEnv } from './_env';

loadEnv();

/**
 * Estado de la base local: version de esquema, integridad y reparto por
 * categoria. Solo lee.
 *
 *   npm run db:check
 */
async function main() {
  const { getDb, closeDb } = await import('../src/lib/db');
  const { SCHEMA_VERSION } = await import('../src/lib/migrations');

  const db = getDb();
  const one = <T>(sql: string): T => db.prepare(sql).get() as T;

  const version = db.pragma('user_version', { simple: true });
  const integrity = db.pragma('integrity_check', { simple: true });

  console.log(`esquema      : v${version} (esperada v${SCHEMA_VERSION})`);
  console.log(`integridad   : ${integrity}`);
  console.log(`correos      : ${one<{ n: number }>('SELECT COUNT(*) AS n FROM emails').n}`);
  console.log(`sin leer     : ${one<{ n: number }>('SELECT COUNT(*) AS n FROM emails WHERE is_read = 0').n}`);
  console.log(`archivados   : ${one<{ n: number }>('SELECT COUNT(*) AS n FROM emails WHERE is_archived = 1').n}`);
  console.log(
    `indices      : ${one<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").n}`,
  );
  console.log(
    `triggers     : ${one<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").n}`,
  );

  console.log('\nreparto por categoria:');
  const rows = db
    .prepare(
      `SELECT category, COUNT(*) AS total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
       FROM emails GROUP BY category ORDER BY total DESC`,
    )
    .all() as { category: string; total: number; unread: number }[];

  const max = Math.max(...rows.map((r) => r.total), 1);
  for (const row of rows) {
    const bar = '#'.repeat(Math.round((row.total / max) * 24));
    console.log(
      `  ${row.category.padEnd(12)} ${String(row.total).padStart(3)}  ${bar} (${row.unread} sin leer)`,
    );
  }

  closeDb();
  process.exit(0);
}

void main();
