/**
 * Codigo de arranque del servidor de Next.js.
 *
 * Next llama a `register()` una vez, antes de atender la primera peticion. Es
 * el sitio para la configuracion global que necesitan las rutas API.
 */
export async function register() {
  // Solo en el runtime de Node: en el Edge no existe el modulo `tls`.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const tls = await import('node:tls');

  /**
   * Mismo problema que en los scripts de CLI: un antivirus que inspecciona
   * trafico cifrado (Kaspersky y similares) intercepta la conexion TLS con
   * Gmail y la re-firma con una raiz propia del almacen de Windows, que Node
   * no consulta. Sin esto, "Sincronizar Ahora" falla con "self-signed
   * certificate in certificate chain" aunque el mismo sync funcione por
   * consola.
   *
   * Se amplian las autoridades de confianza con las del sistema; no se
   * desactiva la verificacion.
   */
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
    // fabrica, que es el comportamiento que habria sin este archivo.
  }
}
