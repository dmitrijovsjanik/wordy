/** Admin Panel Configuration */

// Telegram IDs with admin access
const ADMIN_TELEGRAM_IDS: bigint[] = [409693570n];

export function isAdmin(platform: 'telegram' | 'vk', platformId: bigint | string): boolean {
  // Пока только TG-админы
  if (platform !== 'telegram') return false;
  const id = typeof platformId === 'string' ? BigInt(platformId) : platformId;
  return ADMIN_TELEGRAM_IDS.includes(id);
}
