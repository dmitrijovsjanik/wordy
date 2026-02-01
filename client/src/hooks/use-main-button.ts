import { useEffect } from 'react';
import { telegram } from '@/lib/telegram';

export function useMainButton(text: string, onClick: () => void, visible = true) {
  useEffect(() => {
    if (!telegram.isAvailable) return;

    const btn = window.Telegram.WebApp.MainButton;
    btn.text = text;

    if (visible) {
      btn.onClick(onClick);
      btn.show();
    } else {
      btn.hide();
    }

    return () => {
      btn.offClick(onClick);
      btn.hide();
    };
  }, [text, onClick, visible]);
}
