-- ---------------------------------------------------------------------------
-- SmartMail Triage - esquema local (SQLite)
-- Cachea los correos ya clasificados para no volver a pedirlos a la Gmail API.
-- ---------------------------------------------------------------------------

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS emails (
  id             TEXT PRIMARY KEY,           -- Gmail message ID
  thread_id      TEXT NOT NULL,
  sender_name    TEXT NOT NULL DEFAULT '',
  sender_email   TEXT NOT NULL DEFAULT '',
  subject        TEXT NOT NULL DEFAULT '(sin asunto)',
  date_received  TEXT NOT NULL,              -- ISO 8601
  snippet        TEXT NOT NULL DEFAULT '',
  body_preview   TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL DEFAULT 'GENERAL'
                 CHECK (category IN ('JOB','URGENT','FINANCE','NEWS','INTERESTING','PROMO','GENERAL')),
  confidence     REAL NOT NULL DEFAULT 0,
  extracted_data TEXT NOT NULL DEFAULT '{}', -- JSON
  is_read        INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  is_archived    INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1)),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Los tres filtros que usa el dashboard en cada render.
CREATE INDEX IF NOT EXISTS idx_emails_category  ON emails (category);
CREATE INDEX IF NOT EXISTS idx_emails_date      ON emails (date_received DESC);
CREATE INDEX IF NOT EXISTS idx_emails_unread    ON emails (is_read, is_archived);
CREATE INDEX IF NOT EXISTS idx_emails_sender    ON emails (sender_email);

-- Bitacora de sincronizaciones: alimenta el timestamp de "ultima sincronizacion".
CREATE TABLE IF NOT EXISTS sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  source      TEXT NOT NULL DEFAULT 'gmail',
  fetched     INTEGER NOT NULL DEFAULT 0,
  inserted    INTEGER NOT NULL DEFAULT 0,
  updated     INTEGER NOT NULL DEFAULT 0,
  skipped     INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'running'
              CHECK (status IN ('running','ok','error')),
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_started ON sync_log (started_at DESC);

-- Mantiene updated_at al dia sin que cada UPDATE tenga que acordarse.
CREATE TRIGGER IF NOT EXISTS trg_emails_updated_at
AFTER UPDATE ON emails
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE emails SET updated_at = datetime('now') WHERE id = NEW.id;
END;
