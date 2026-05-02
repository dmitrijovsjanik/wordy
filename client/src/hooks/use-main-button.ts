import { useEffect } from 'react';
import { platformBridge } from '@/lib/platform-bridge';

export function useMainButton(text: string, onClick: () => void, visible = true) {
  useEffect(() => {
    if (!platformBridge.hasNativeMainButton) return;

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
