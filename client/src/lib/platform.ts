export type Platform = 'telegram' | 'vk' | 'dev';

function detectPlatform(): Platform {
  // VK Mini App передаёт vk_app_id в URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('vk_app_id')) return 'vk';

  // Telegram Mini App
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) return 'telegram';

  return 'dev';
}

/** Платформа определяется один раз при загрузке */
export const currentPlatform: Platform = detectPlatform();
