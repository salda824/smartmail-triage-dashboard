import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import dotenv from 'dotenv';

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

/**
 * Anade al conjunto de confianza los certificados raiz del sistema operativo.
 *
 * Los antivirus que inspeccionan trafico cifrado (Kaspersky, ESET, Avast y
 * similares) interceptan la conexion TLS y la re-firman con una raiz propia
 * que instalan en el almacen de Windows. Node no usa ese almacen: trae su
 * propia lista de CAs, no encuentra la raiz del antivirus y aborta con
 * "self-signed certificate in certificate chain".
 *
 * Se amplia el conjunto de autoridades de confianza con las que el sistema ya
 * considera validas. **En ningun momento se desactiva la verificacion del
 * certificado**, que seria la solucion facil y equivocada.
 *
 * Se hace en caliente y no con la opcion `--use-system-ca` porque NODE_OPTIONS
 * solo se lee al arrancar el proceso: cambiarla desde dentro no tendria efecto.
 */
function trustSystemCertificates(): void {
  // API disponible desde Node 22.15. En versiones anteriores no hay nada que
  // hacer y la conexion seguira fallando tras un antivirus que intercepte TLS.
  if (
    typeof tls.getCACertificates !== 'function' ||
    typeof tls.setDefaultCACertificates !== 'function'
  ) {
    return;
  }

  try {
    const combinados = new Set([
      ...tls.getCACertificates('default'),
      ...tls.getCACertificates('system'),
    ]);
    tls.setDefaultCACertificates([...combinados]);
  } catch {
    // Si el almacen del sistema no se puede leer, se sigue con la lista que
    // Node trae de fabrica: es lo que habria pasado sin esta funcion.
  }
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
