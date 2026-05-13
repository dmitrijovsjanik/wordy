import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// happy-dom между тестами не убирает DOM сам.
afterEach(() => {
  cleanup();
});

// Заглушки для Telegram WebView API — компоненты могут косвенно их трогать.
if (!('Telegram' in window)) {
  (window as unknown as { Telegram: unknown }).Telegram = {
    WebApp: {
      HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
      MainButton: { show: () => {}, hide: () => {}, setText: () => {}, onClick: () => {}, offClick: () => {} },
      BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
      expand: () => {},
      themeParams: {},
    },
  };
}

// SpeechSynthesisUtterance заглушка (используется в tts.ts).
if (!('speechSynthesis' in window)) {
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    speak: () => {},
    cancel: () => {},
    getVoices: () => [],
  };
}
if (!('SpeechSynthesisUtterance' in window)) {
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    constructor(public text: string) {}
  };
}
