import { loadEnv } from './_env';

loadEnv();

/**
 * Comprueba la conexion IMAP sin tocar la base de datos.
 *
 *   npm run imap:test
 *
 * Solo lee: abre la bandeja, cuenta los mensajes y muestra los asuntos mas
 * recientes para confirmar que las credenciales y los permisos funcionan.
 */
async function main() {
  const { ImapSource, readImapConfig } = await import('../src/lib/gmail/imap');

  let config;
  try {
    config = readImapConfig();
  } catch (error) {
    console.error(`\n[imap] ${error instanceof Error ? error.message : String(error)}\n`);
    console.error('Pasos:');
    console.error('  1. Activa la verificacion en dos pasos de tu cuenta de Google');
    console.error('  2. Crea una contrasena de aplicacion en https://myaccount.google.com/apppasswords');
    console.error('  3. Pega IMAP_USER e IMAP_APP_PASSWORD en .env.local\n');
    process.exit(1);
  }

  console.log(`[imap] servidor : ${config.host}:${config.port}`);
  console.log(`[imap] cuenta   : ${config.user}`);
  console.log('[imap] conectando...');

  const source = new ImapSource(config);

  try {
    const info = await source.verifyConnection();
    console.log(`[imap] conexion correcta: ${info.total} mensajes en ${info.mailbox}`);

    console.log('[imap] descargando los 5 mas recientes para comprobar el parseo...');
    const messages = await source.fetchRecent({ maxResults: 5 });

    if (messages.length === 0) {
      console.log('[imap] la busqueda no devolvio mensajes recientes (revisa IMAP_SINCE_DAYS)');
    } else {
      for (const m of messages) {
        const estado = m.isRead ? 'leido    ' : 'sin leer ';
        console.log(`  ${estado} ${m.dateReceived.slice(0, 10)}  ${m.senderEmail.padEnd(34).slice(0, 34)}  ${m.subject.slice(0, 58)}`);
      }
    }

    console.log('\n[imap] todo en orden. Ya puedes ejecutar: npm run sync\n');
    process.exit(0);
  } catch (error) {
    console.error(`\n[imap] ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

void main();
