import type {
  AuthResponse,
  User,
  UserStats,
  CollectionGroup,
  LibraryCollection,
  CollectionDetail,
  AllWordsResponse,
  DictionaryLookupResult,
  LeagueStatusResponse,
  LeaderboardEntry,
  LeagueNotification,
  LeagueHistoryEntry,
  FriendInfo,
  FriendRequestInfo,
  StreakCalendarResponse,
  CefrProgressResponse,
  LearningNextResponse,
  LearningAnswerRequest,
  LearningAnswerResponse,
  LearningSwipeRequest,
  LearningSwipeResponse,
} from '@/types/api';

const TOKEN_KEY = 'wordy_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiRequestError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'ApiRequestError';
  }
}

async function fetchApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Ошибка сервера', code: 'UNKNOWN' }));
    throw new ApiRequestError(data.error ?? 'Ошибка сервера', data.code ?? 'UNKNOWN');
  }

  return res.json() as Promise<T>;
}

// Auth
export function authInit(initData: string) {
  return fetchApi<AuthResponse>('POST', '/api/auth/init', { initData });
}

export function authVkInit(launchParams: string) {
  return fetchApi<AuthResponse>('POST', '/api/auth/vk-init', { launchParams });
}

export function authDev() {
  return fetchApi<AuthResponse>('GET', '/api/auth/dev');
}

export function linkAccount(platform: 'telegram' | 'vk', initData: string) {
  return fetchApi<{ success: boolean; message: string }>('POST', '/api/auth/link', { platform, initData });
}

// Quiz API удалён (legacy /api/quiz/*). Архив: archive/v1-learning-flow/.

// ─── Learning API (лестница: pool/passive/active/review/mastered) ──────────

const LEARNING_BASE = '/api/learning';

export function learningNext(opts: {
  collectionId?: number;
  /** Anti-repeat: последние N показанных wordId. Клиент шлёт окно 3, сервер cap'ает до 10. */
  excludeWordIds?: number[];
} = {}) {
  const params = new URLSearchParams();
  if (opts.collectionId !== undefined) params.set('collectionId', String(opts.collectionId));
  if (opts.excludeWordIds?.length) params.set('excludeWordIds', opts.excludeWordIds.join(','));
  const qs = params.toString();
  return fetchApi<LearningNextResponse>('GET', `${LEARNING_BASE}/next${qs ? '?' + qs : ''}`);
}

export function learningAnswer(input: LearningAnswerRequest) {
  return fetchApi<LearningAnswerResponse>('POST', `${LEARNING_BASE}/answer`, input);
}

export function learningSwipe(input: LearningSwipeRequest) {
  return fetchApi<LearningSwipeResponse>('POST', `${LEARNING_BASE}/swipe`, input);
}

// Duels API удалён (legacy /api/duels/*). Архив: archive/v1-learning-flow/.

// User
export function getMe() {
  return fetchApi<User>('GET', '/api/users/me');
}

export function getMyStats() {
  return fetchApi<UserStats>('GET', '/api/users/me/stats');
}

export type DailyRewardsResponse = {
  dailyPlayDone: boolean;
  duelWinDone: boolean;
  streakDays: number;
  dailyCorrectCount: number;
  streakMilestonesDone: number[];
  correctMilestonesDone: number[];
};

export function getDailyRewards() {
  return fetchApi<DailyRewardsResponse>('GET', '/api/users/me/daily-rewards');
}

export function updateLanguages(nativeLanguage: string, learningLanguage: string) {
  return fetchApi<{ nativeLanguage: string; learningLanguage: string }>(
    'PUT',
    '/api/users/me/languages',
    { nativeLanguage, learningLanguage },
  );
}

export function updateSettings(settings: { repeatMastered?: boolean; ttsVoice?: string }) {
  return fetchApi<{ repeatMastered?: boolean; ttsVoice?: string }>('PATCH', '/api/users/me/settings', settings);
}

export function purchaseStreakFreeze(days: number) {
  return fetchApi<{ success: boolean; gems: number; streakFreezes: number }>(
    'POST',
    '/api/users/me/streak-freeze/purchase',
    { days },
  );
}

export function createPayment(itemType: string) {
  return fetchApi<{ confirmationUrl: string; paymentId: string }>(
    'POST',
    '/api/payments/create',
    { itemType },
  );
}

export function getPremiumStatus() {
  return fetchApi<{ isPremium: boolean; premiumUntil: string | null; premiumPlan: string | null; autoRenew: boolean; hasCard: boolean }>(
    'GET',
    '/api/payments/premium',
  );
}

export function cancelAutoRenew() {
  return fetchApi<{ ok: boolean }>('POST', '/api/payments/cancel-auto-renew');
}

export function enableAutoRenew() {
  return fetchApi<{ ok: boolean }>('POST', '/api/payments/enable-auto-renew');
}

export function unlinkCard() {
  return fetchApi<{ ok: boolean }>('POST', '/api/payments/unlink-card');
}

export function getStreakCalendar(months = 6) {
  return fetchApi<StreakCalendarResponse>('GET', `/api/users/me/streak-calendar?months=${months}`);
}

// Lives
export function getLivesStatus() {
  return fetchApi<{ lives: number; livesRestoredAt: string | null; isInfinite: boolean }>('GET', '/api/users/me/lives');
}

export function refillLives() {
  return fetchApi<{ lives: number; gems: number }>('POST', '/api/users/me/lives/refill');
}

// XP Boost
export function purchaseXpBoost() {
  return fetchApi<{ success: boolean; until: string; gems: number }>('POST', '/api/users/me/xp-boost/purchase');
}

// Collections
export function getMarketplace() {
  return fetchApi<{ groups: CollectionGroup[] }>('GET', '/api/collections/marketplace');
}

export function getLibrary() {
  return fetchApi<{ collections: LibraryCollection[] }>('GET', '/api/collections/library');
}

export function getCollectionDetail(id: number) {
  return fetchApi<CollectionDetail>('GET', `/api/collections/${id}`);
}

export function subscribeCollection(id: number) {
  return fetchApi<{ success: boolean }>('POST', `/api/collections/${id}/subscribe`);
}

export function unsubscribeCollection(id: number) {
  return fetchApi<{ success: boolean }>('DELETE', `/api/collections/${id}/unsubscribe`);
}

export function toggleCollection(id: number, isActive: boolean) {
  return fetchApi<{ success: boolean }>('PATCH', `/api/collections/${id}/toggle`, { isActive });
}

export function createCollection(data: {
  title: string;
  description?: string;
  words?: { wordText: string; translation: string; partOfSpeech?: string }[];
}) {
  return fetchApi<{ collectionId: number }>('POST', '/api/collections', data);
}

export function updateCollection(id: number, data: {
  title?: string;
  description?: string;
  words?: { wordText: string; translation: string; partOfSpeech?: string }[];
}) {
  return fetchApi<{ success: boolean }>('PATCH', `/api/collections/${id}`, data);
}

export function deleteCollection(id: number) {
  return fetchApi<{ success: boolean }>('DELETE', `/api/collections/${id}`);
}

export function getAllWords() {
  return fetchApi<AllWordsResponse>('GET', '/api/collections/words');
}

// Dictionary
export function dictionaryLookup(text: string) {
  return fetchApi<DictionaryLookupResult>('GET', `/api/dictionary/lookup?text=${encodeURIComponent(text)}`);
}

// Collection Words
export function addCollectionWords(collectionId: number, data: {
  meaningIds?: number[];
  custom?: { wordText: string; translation: string; partOfSpeech?: string }[];
}) {
  return fetchApi<{ success: boolean; added: number }>('POST', `/api/collections/${collectionId}/words`, data);
}

export function removeCollectionWord(collectionId: number, wordId: number, type: 'meaning' | 'custom' = 'meaning') {
  return fetchApi<{ success: boolean; deleted: number }>('DELETE', `/api/collections/${collectionId}/words/${wordId}?type=${type}`);
}

// Legacy infinite-quiz/grammar/match-pairs/hint endpoints удалены.
// Архив: archive/v1-learning-flow/.

// Leagues — endpoints оставлены, потому что league-виджеты в dashboard/profile
// всё ещё используют их (но скрыты PILOT_FEATURES.leagues = false). Удалить
// можно когда виджеты выпилим.
export function getLeagueStatus() {
  return fetchApi<LeagueStatusResponse>('GET', '/api/leagues/me');
}

export function getLeaderboard() {
  return fetchApi<{ entries: LeaderboardEntry[] }>('GET', '/api/leagues/leaderboard');
}

export function getLeagueNotifications() {
  return fetchApi<{ notifications: LeagueNotification[] }>('GET', '/api/leagues/notifications');
}

export function markLeagueNotificationsRead(ids: number[]) {
  return fetchApi<{ success: boolean }>('POST', '/api/leagues/notifications/read', { ids });
}

export function getLeagueHistory() {
  return fetchApi<{ history: LeagueHistoryEntry[] }>('GET', '/api/leagues/history');
}

// Friends
export function getFriendsList() {
  return fetchApi<{ friends: FriendInfo[] }>('GET', '/api/friends');
}

export function getMyFriendCode() {
  return fetchApi<{ friendCode: string }>('GET', '/api/friends/my-code');
}

export function getInviteToken() {
  return fetchApi<{ token: string }>('GET', '/api/friends/invite-token');
}

export function sendFriendRequest(friendCode: string) {
  return fetchApi<{ success: boolean; requestId: number }>('POST', '/api/friends/request', { friendCode });
}

export function getIncomingFriendRequests() {
  return fetchApi<{ requests: FriendRequestInfo[]; count: number }>('GET', '/api/friends/requests');
}

export function acceptFriendRequest(requestId: number) {
  return fetchApi<{ success: boolean }>('POST', `/api/friends/requests/${requestId}/accept`);
}

export function declineFriendRequest(requestId: number) {
  return fetchApi<{ success: boolean }>('POST', `/api/friends/requests/${requestId}/decline`);
}

export function acceptInvite(token: string) {
  return fetchApi<{ success: boolean; friendId: number }>('POST', '/api/friends/accept-invite', { token });
}

export function removeFriend(friendId: number) {
  return fetchApi<{ success: boolean }>('DELETE', `/api/friends/${friendId}`);
}

// CEFR Progress
export function getCefrProgress() {
  return fetchApi<CefrProgressResponse>('GET', '/api/users/me/cefr-progress');
}

// Grammar и Reading endpoints удалены. Архив: archive/v1-learning-flow/.
