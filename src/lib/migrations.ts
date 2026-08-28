import type Database from 'better-sqlite3';

/**
 * Migraciones del esquema.
 *
 * `schema.sql` usa CREATE TABLE IF NOT EXISTS, asi que una base ya existente
 * conserva su definicion antigua para siempre: los cambios de esquema tienen
 * que aplicarse aqui. La version vivida en `PRAGMA user_version`, que SQLite
 * guarda en la propia base sin necesidad de una tabla auxiliar.
 */

type DB = Database.Database;

export const SCHEMA_VERSION = 2;

interface Migration {
  version: number;
  description: string;
  up: (db: DB) => void;
}

const MIGRATIONS: Migration[] = [
  {
    version: 2,
    description: 'Anade la categoria PROMO a la restriccion CHECK de emails',
    up: (db) => {
      // SQLite no permite modificar un CHECK con ALTER TABLE. El procedimiento
      // soportado es recrear la tabla y copiar las filas; los indices y el
      // trigger se vuelven a crear despues desde schema.sql.
      db.exec(`
        CREATE TABLE emails_migrated (
          id             TEXT PRIMARY KEY,
          thread_id      TEXT NOT NULL,
          sender_name    TEXT NOT NULL DEFAULT '',
          sender_email   TEXT NOT NULL DEFAULT '',
          subject        TEXT NOT NULL DEFAULT '(sin asunto)',
          date_received  TEXT NOT NULL,
          snippet        TEXT NOT NULL DEFAULT '',
          body_preview   TEXT NOT NULL DEFAULT '',
          category       TEXT NOT NULL DEFAULT 'GENERAL'
                         CHECK (category IN ('JOB','URGENT','FINANCE','NEWS','INTERESTING','PROMO','GENERAL')),
          confidence     REAL NOT NULL DEFAULT 0,
          extracted_data TEXT NOT NULL DEFAULT '{}',
          is_read        INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
          is_archived    INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1)),
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO emails_migrated
        SELECT id, thread_id, sender_name, sender_email, subject, date_received,
               snippet, body_preview, category, confidence, extracted_data,
               is_read, is_archived, created_at, updated_at
        FROM emails;

        DROP TABLE emails;
        ALTER TABLE emails_migrated RENAME TO emails;
      `);
    },
  },
];

/**
 * Aplica las migraciones pendientes.
 *
 * Se llama despues de `schema.sql`: en una base nueva la tabla ya nace con el
 * esquema actual, asi que solo se marca la version y no se ejecuta nada.
 */
export function migrate(db: DB, isFreshDatabase: boolean): boolean {
  const current = db.pragma('user_version', { simple: true }) as number;

  if (isFreshDatabase || current >= SCHEMA_VERSION) {
    if (current !== SCHEMA_VERSION) db.pragma(`user_version = ${SCHEMA_VERSION}`);
    return false;
  }

  let applied = false;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;

    // Cada migracion es atomica: si falla a medias, la base queda como estaba.
    const run = db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    });

    run();
    applied = true;
    console.info(`[db] migracion ${migration.version} aplicada: ${migration.description}`);
  }

  return applied;
}
