const isDev = import.meta.env.DEV;

type ThemeParams = {
  bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  secondary_bg_color: string;
};

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'error' | 'success' | 'warning';

const mockThemeParams: ThemeParams = {
  bg_color: '#ffffff',
  text_color: '#000000',
  hint_color: '#999999',
  link_color: '#5b5ea6',
  button_color: '#5b5ea6',
  button_text_color: '#ffffff',
  secondary_bg_color: '#f0f0f0',
};

function isAvailable() {
  return !isDev && typeof window !== 'undefined' && window.Telegram?.WebApp != null;
}

/** Safe wrapper — never throws */
function safeCall(fn: () => void) {
  try { fn(); } catch { /* Telegram SDK version mismatch */ }
}

export const telegram = {
  get isAvailable() {
    return isAvailable();
  },

  get themeParams(): ThemeParams {
    if (isAvailable()) {
      return window.Telegram.WebApp.themeParams as ThemeParams;
    }
    return mockThemeParams;
  },

  expand() {
    safeCall(() => {
      if (isAvailable()) window.Telegram.WebApp.expand();
    });
  },

  requestFullscreen() {
    safeCall(() => {
      if (isAvailable() && window.Telegram.WebApp.requestFullscreen) {
        window.Telegram.WebApp.requestFullscreen();
      }
    });
  },

  disableVerticalSwipes() {
    safeCall(() => {
      if (isAvailable() && window.Telegram.WebApp.disableVerticalSwipes) {
        window.Telegram.WebApp.disableVerticalSwipes();
      }
    });
  },

  hapticImpact(style: HapticStyle) {
    safeCall(() => {
      if (isAvailable()) window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    });
  },

  hapticNotification(type: HapticNotification) {
    safeCall(() => {
      if (isAvailable()) window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
    });
  },

  get initData(): string | null {
    if (isAvailable()) {
      return window.Telegram.WebApp.initData || null;
    }
    return null;
  },

  get startParam(): string | null {
    if (isAvailable()) {
      return window.Telegram.WebApp.initDataUnsafe?.start_param ?? null;
    }
    return null;
  },
};

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        themeParams: Record<string, string>;
        expand: () => void;
        requestFullscreen?: () => void;
        disableVerticalSwipes?: () => void;
        initData: string;
        initDataUnsafe?: { start_param?: string };
        HapticFeedback: {
          impactOccurred: (style: HapticStyle) => void;
          notificationOccurred: (type: HapticNotification) => void;
        };
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
      };
    };
  }
}
