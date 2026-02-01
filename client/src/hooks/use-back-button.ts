import { useEffect } from 'react';
import { telegram } from '@/lib/telegram';

export function useBackButton(onBack: () => void) {
  useEffect(() => {
    if (!telegram.isAvailable) return;

    const btn = window.Telegram.WebApp.BackButton;
    btn.onClick(onBack);
    btn.show();

    return () => {
      btn.offClick(onBack);
      btn.hide();
    };
  }, [onBack]);
}
