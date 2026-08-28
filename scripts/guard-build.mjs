import net from 'node:net';

/**
 * Impide compilar mientras el servidor de desarrollo esta levantado.
 *
 * `next dev` y `next build` escriben los dos en `.next`. Si el build corre con
 * el servidor activo, le sustituye los chunks que tiene en uso y el servidor
 * pasa a servir un CSS vacio: la pagina se ve como HTML sin estilos, sin un
 * solo error en consola que lo explique.
 *
 * Es un fallo que cuesta reconocer y que ya se ha dado dos veces en este
 * proyecto, asi que vale la pena que el propio build se niegue a arrancar.
 */

const PORT = Number(process.env.PORT ?? 3000);

if (process.env.SKIP_BUILD_GUARD === '1') process.exit(0);

function puertoOcupado(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const cerrar = (ocupado) => {
      socket.destroy();
      resolve(ocupado);
    };
    socket.setTimeout(600);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

if (await puertoOcupado(PORT)) {
  console.error(`
  El puerto ${PORT} esta ocupado: parece que "npm run dev" sigue corriendo.

  Compilar ahora sobrescribiria los archivos que el servidor tiene en uso y la
  pagina quedaria sin estilos hasta reiniciarlo.

  Deten el servidor de desarrollo y vuelve a intentarlo. Si en ese puerto hay
  otra cosa y sabes lo que haces, puedes saltarte la comprobacion:

      PowerShell:  $env:SKIP_BUILD_GUARD=1; npm run build
      bash:        SKIP_BUILD_GUARD=1 npm run build
`);
  process.exit(1);
}
