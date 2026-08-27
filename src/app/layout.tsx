import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartMail Triage',
  description: 'Dashboard inteligente de clasificacion y gestion de correos de Gmail.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0D0E12' },
    { media: '(prefers-color-scheme: light)', color: '#F9FAFB' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * Se ejecuta antes de la primera pintura para evitar el destello de tema
 * equivocado: lee la preferencia guardada, y si no hay, la del sistema.
 */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('smartmail:theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      {/*
        El script va como primer hijo de <body>, no en <head>: en el App Router
        Next gestiona <head> por su cuenta y meter etiquetas sueltas ahi provoca
        un desajuste de hidratacion. Aqui corre igual antes de que se pinte el
        resto del arbol, que es lo unico que importa para evitar el destello.
      */}
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
