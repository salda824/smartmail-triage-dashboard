import type { Config } from 'tailwindcss';

/**
 * Paleta "cyber-clean": base pizarra/medianoche + acentos electricos.
 * Los colores de categoria viven aqui para que UI y badges compartan una sola fuente de verdad.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          950: '#070A12',
          900: '#0B0F19',
          800: '#111827',
          750: '#161E2E',
          700: '#1F2937',
          600: '#293548',
          500: '#334155',
        },
        accent: {
          blue: '#3B82F6',
          violet: '#8B5CF6',
          orange: '#F97316',
          coral: '#EF4444',
          emerald: '#10B981',
          cyan: '#06B6D4',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(59,130,246,0.25), 0 8px 32px -8px rgba(59,130,246,0.35)',
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-800px 0' },
          '100%': { backgroundPosition: '800px 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.28s ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
