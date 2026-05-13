import { useEffect } from 'react';
import { platformBridge } from '@/lib/platform-bridge';

export function useBackButton(onBack: () => void) {
  useEffect(() => {
    if (!platformBridge.hasNativeBackButton) return;

    const btn = window.Telegram.WebApp.BackButton;
    btn.onClick(onBack);
    btn.show();

    return () => {
      btn.offClick(onBack);
      btn.hide();
    };
  }, [onBack]);
}
