'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'smartmail:theme';

/**
 * Interruptor de tema.
 *
 * El valor inicial lo aplica un script en el <head> (ver layout.tsx) antes de
 * pintar, para que no haya destello de tema equivocado. Aqui solo se lee lo que
 * ya quedo puesto en el DOM y se sincroniza el estado de React.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Modo incognito con almacenamiento bloqueado: el tema dura la sesion.
    }
  };

  return (
    <IconButton
      size="sm"
      label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onClick={toggle}
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </IconButton>
  );
}
