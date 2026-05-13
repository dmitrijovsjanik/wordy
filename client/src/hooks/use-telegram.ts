import { platformBridge } from '@/lib/platform-bridge';

// Стабильные ссылки на уровне модуля: bind() возвращает новую функцию
// при каждом вызове, поэтому раньше каждый рендер хук отдавал новые
// hapticImpact/hapticNotification. Любой useEffect с этими функциями в
// deps зацикливался, если внутри него менялся стейт.
const haptics = {
  isAvailable: platformBridge.platform !== 'dev',
  hapticImpact: platformBridge.hapticImpact.bind(platformBridge),
  hapticNotification: platformBridge.hapticNotification.bind(platformBridge),
};

export function useTelegram() {
  return haptics;
}
