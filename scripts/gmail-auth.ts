import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { loadEnv } from './_env';

loadEnv();

/**
 * Obtiene el refresh token de Gmail.
 *
 * Flujo: se imprime la URL de consentimiento, el usuario autoriza en su propio
 * navegador y pega de vuelta el codigo. El token se guarda en `.gmail-token.json`
 * (ignorado por git) y se imprime para copiarlo a `.env.local`.
 */
async function main() {
  const { createOAuthClient, GMAIL_SCOPES } = await import('../src/lib/gmail/client');

  let client;
  try {
    client = createOAuthClient();
  } catch (error) {
    console.error(`\n[auth] ${error instanceof Error ? error.message : String(error)}\n`);
    console.error('Pasos previos:');
    console.error('  1. Crea un proyecto en https://console.cloud.google.com');
    console.error('  2. Habilita la Gmail API');
    console.error('  3. Crea credenciales OAuth de tipo "Aplicacion de escritorio"');
    console.error('  4. Copia .env.example a .env.local y pega CLIENT_ID y CLIENT_SECRET\n');
    process.exit(1);
  }

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    // Fuerza la pantalla de consentimiento para que Google devuelva refresh_token
    // incluso si ya autorizaste antes esta aplicacion.
    prompt: 'consent',
  });

  console.log('\n--------------------------------------------------------------');
  console.log('1) Abre esta URL en tu navegador y autoriza el acceso:\n');
  console.log(url);
  console.log('\n2) Google te devolvera un codigo. Pegalo aqui abajo.');
  console.log('--------------------------------------------------------------\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question('Codigo: ')).trim();
  rl.close();

  if (!code) {
    console.error('[auth] No se recibio ningun codigo.');
    process.exit(1);
  }

  try {
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      console.error(
        '\n[auth] Google no devolvio refresh_token. Revoca el acceso en https://myaccount.google.com/permissions y repite.\n',
      );
      process.exit(1);
    }

    const tokenPath = path.join(process.cwd(), '.gmail-token.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });

    console.log('\n[auth] Listo. Token guardado en .gmail-token.json');
    console.log('\nAgrega estas lineas a tu .env.local:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('MAIL_SOURCE=gmail\n');
  } catch (error) {
    console.error(`\n[auth] Fallo al canjear el codigo: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

void main();
