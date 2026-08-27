import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Conexion unica a SQLite.
 *
 * En desarrollo Next.js recarga los modulos en caliente, asi que la instancia se
 * guarda en `globalThis` para no abrir un descriptor nuevo en cada recarga.
 */

type DB = Database.Database;

const globalForDb = globalThis as unknown as { __smartmailDb?: DB };

function resolveDbPath(): string {
  const configured = process.env.SMARTMAIL_DB_PATH?.trim();
  const target = configured && configured.length > 0 ? configured : './data/smartmail.db';
  return path.isAbsolute(target) ? target : path.join(process.cwd(), target);
}

function applySchema(db: DB): void {
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

function createConnection(): DB {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Evita "database is locked" cuando el cron y el dashboard escriben a la vez.
  db.pragma('busy_timeout = 5000');

  applySchema(db);
  return db;
}

export function getDb(): DB {
  if (!globalForDb.__smartmailDb) {
    globalForDb.__smartmailDb = createConnection();
  }
  return globalForDb.__smartmailDb;
}

/** Cierra la conexion. Usado por los scripts de CLI al terminar. */
export function closeDb(): void {
  if (globalForDb.__smartmailDb) {
    globalForDb.__smartmailDb.close();
    globalForDb.__smartmailDb = undefined;
  }
}
