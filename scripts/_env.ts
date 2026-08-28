import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { trustSystemCertificates } from '../src/lib/tls-trust';

/**
 * Carga de variables para los scripts de CLI.
 *
 * Next.js hace esto solo cuando corre el servidor; los scripts sueltos (el cron
 * diario, por ejemplo) tienen que hacerlo a mano. Se respeta el mismo orden de
 * precedencia de Next: `.env.local` gana sobre `.env`.
 */
export function loadEnv(): void {
  const root = process.cwd();
  for (const file of ['.env.local', '.env']) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) dotenv.config({ path: full });
  }
  trustSystemCertificates();
}


/** Lee un flag `--clave valor` de argv. */
export function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
