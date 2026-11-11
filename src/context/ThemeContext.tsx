import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface ThemeContextType {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>(null!);

const STORAGE_KEY = 'theme';
const SYSTEM_DARK = '(prefers-color-scheme: dark)';

function readSaved(): 'dark' | 'light' | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(SYSTEM_DARK).matches;
}

/**
 * Light/dark for the whole app (login included). With no saved choice it follows the system
 * setting, live; once someone flips the toggle, that choice is saved under 'theme' and wins.
 * index.html applies the same rule before React mounts, so there's no flash of the wrong theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [explicit, setExplicit] = useState<'dark' | 'light' | null>(readSaved);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const dark = explicit ? explicit === 'dark' : systemDark;

  useEffect(() => {
    const mq = window.matchMedia?.(SYSTEM_DARK);
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setExplicit(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode: in-memory only */ }
  };

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** @see react-refresh/only-export-components — hook colocated with provider */
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}
