import type { Config } from 'tailwindcss';

/**
 * Los colores salen de variables CSS (ver globals.css) para que el tema claro y
 * el oscuro compartan un solo juego de clases. `<alpha-value>` permite seguir
 * usando modificadores de opacidad como `bg-accent/15`.
 */
const rgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: rgb('bg'),
        surface: {
          DEFAULT: rgb('surface'),
          2: rgb('surface-2'),
          3: rgb('surface-3'),
        },
        text: {
          DEFAULT: rgb('text'),
          2: rgb('text-2'),
          3: rgb('text-3'),
        },
        accent: {
          DEFAULT: rgb('accent'),
          violet: rgb('accent-violet'),
          amber: rgb('accent-amber'),
          red: rgb('accent-red'),
          green: rgb('accent-green'),
          cyan: rgb('accent-cyan'),
        },
      },
      borderColor: {
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
      },
      boxShadow: {
        panel: 'var(--shadow)',
        // Elevacion para menus y popovers, sin resplandor de color.
        pop: '0 4px 8px -2px rgba(0,0,0,0.28), 0 16px 40px -12px rgba(0,0,0,0.45)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        sidebar: '15rem',
        toolbar: '3.5rem',
      },
      animation: {
        'slide-up': 'slide-up 0.24s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.18s ease-out both',
      },
      transitionTimingFunction: {
        snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
