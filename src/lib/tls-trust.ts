import tls from 'node:tls';

/**
 * Confianza en los certificados raiz del sistema operativo.
 *
 * Los antivirus que inspeccionan trafico cifrado (Kaspersky, ESET, Avast y
 * similares) interceptan la conexion TLS y la re-firman con una raiz propia
 * que instalan en el almacen del sistema. Node no consulta ese almacen: trae
 * su propia lista de autoridades, no encuentra la raiz del antivirus y aborta
 * con "self-signed certificate in certificate chain".
 *
 * Se **amplia** el conjunto de autoridades de confianza con las que el sistema
 * ya considera validas. En ningun momento se desactiva la verificacion del
 * certificado, que seria la salida facil y dejaria la conexion abierta a
 * cualquier intermediario, no solo al antivirus.
 *
 * Vive aqui y no en `instrumentation.ts` porque ese archivo lo compila webpack
 * tambien para el runtime Edge, donde `node:tls` no existe y la compilacion
 * falla entera. Este modulo solo entra por la cadena de las fuentes de correo,
 * que son de servidor.
 */

let aplicado = false;

export function trustSystemCertificates(): void {
  if (aplicado) return;
  aplicado = true;

  // Disponible desde Node 22.15. Antes de esa version no hay forma limpia de
  // hacerlo en caliente y la conexion seguira fallando tras un antivirus que
  // intercepte TLS; el README explica la alternativa con NODE_EXTRA_CA_CERTS.
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
    // Si el almacen del sistema no se puede leer se sigue con la lista de
    // fabrica, que es el comportamiento que habria sin este modulo.
  }
}
