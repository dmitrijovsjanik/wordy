import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  init: () => void;
};

const STORAGE_KEY = 'wordy_theme';

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'dark';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.classList.toggle('dark', isDark);
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: getStoredTheme(),

  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },

  init: () => {
    const theme = getStoredTheme();
    applyTheme(theme);
    set({ theme });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const current = useThemeStore.getState().theme;
      if (current === 'system') {
        applyTheme('system');
      }
    });
  },
}));
