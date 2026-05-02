import { platformBridge } from '@/lib/platform-bridge';

export function useTelegram() {
  return {
    isAvailable: platformBridge.platform !== 'dev',
    hapticImpact: platformBridge.hapticImpact.bind(platformBridge),
    hapticNotification: platformBridge.hapticNotification.bind(platformBridge),
  };
}
