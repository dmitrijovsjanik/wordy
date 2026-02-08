/** Admin Panel Configuration */

// Telegram IDs with admin access
export const ADMIN_IDS: bigint[] = [409693570n];

export function isAdmin(telegramId: bigint | string): boolean {
  const id = typeof telegramId === 'string' ? BigInt(telegramId) : telegramId;
  return ADMIN_IDS.includes(id);
}
