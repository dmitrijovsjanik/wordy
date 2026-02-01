import { telegram } from '@/lib/telegram';

export function useTelegram() {
  return {
    isAvailable: telegram.isAvailable,
    themeParams: telegram.themeParams,
    hapticImpact: telegram.hapticImpact,
    hapticNotification: telegram.hapticNotification,
  };
}
