/**
 * 主題切換 hook（暗/亮），存 localStorage
 *
 * 用法：
 *   const [theme, setTheme] = useTheme();
 *   <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>...</button>
 */
import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const STORAGE_KEY = 'fvr-theme';

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return [theme, setThemeState];
}