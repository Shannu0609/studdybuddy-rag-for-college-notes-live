import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'study_buddy_theme';

export function applyThemeToDom(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
  }
}

export function useTheme(initialTheme) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : initialTheme || 'dark';
  });

  useEffect(() => {
    applyThemeToDom(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    const normalized = nextTheme === 'light' ? 'light' : 'dark';
    setThemeState(normalized);
  }, []);

  return { theme, setTheme };
}

