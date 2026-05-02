import type {
  AuthResponse,
  QuizStartResponse,
  QuizAnswerRequest,
  QuizAnswerResponse,
  QuizResultResponse,
  DuelCreateResponse,
  Duel,
  DuelFinishResponse,
  User,
  UserStats,
  CollectionGroup,
  LibraryCollection,
  CollectionDetail,
  DifficultWordsResponse,
  AllWordsResponse,
  QuizQuestion,
  InfiniteAnswerResponse,
  MatchPairsAnswerResponse,
  GrammarAnswerResponse,
  DictionaryLookupResult,
  LeagueStatusResponse,
  LeaderboardEntry,
  LeagueNotification,
  LeagueHistoryEntry,
  FriendInfo,
  FriendRequestInfo,
  StreakCalendarResponse,
  CefrProgressResponse,
  PlacementStartResponse,
  PlacementAnswerResponse,
  PlacementCompleteResponse,
  LearningNextResponse,
  LearningAnswerResponse,
  ReviewFeedResponse,
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

// Quiz
export function quizStart() {
  return fetchApi<QuizStartResponse>('POST', '/api/quiz/start');
}

export function quizAnswer(data: QuizAnswerRequest) {
  return fetchApi<QuizAnswerResponse>('POST', '/api/quiz/answer', data);
}

export function quizFinish(sessionId: number) {
  return fetchApi<QuizResultResponse>('POST', '/api/quiz/finish', { sessionId });
}

// ─── Learning API (новая лестница, фаза 3) ─────────────────────────────────

export function learningNext(opts: { collectionId?: number | string; recentGenerators?: string[] } = {}) {
  const params = new URLSearchParams();
  if (opts.recentGenerators?.length) params.set('generators', opts.recentGenerators.join(','));
  if (opts.collectionId !== undefined) params.set('collectionId', String(opts.collectionId));
  const qs = params.toString();
  return fetchApi<LearningNextResponse>('GET', `/api/learning/next${qs ? '?' + qs : ''}`);
}

export function learningAnswer(input: {
  meaningId: number;
  isCorrect: boolean;
  questionType?: string;
  answerTimeMs?: number;
  streak?: number;
  skip?: boolean;
  userAnswer?: string;
  acceptableAnswers?: string[];
  partOfSpeech?: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
}) {
  return fetchApi<LearningAnswerResponse>('POST', '/api/learning/answer', input);
}

export function learningSwipe(input: { meaningId: number; action: 'known' | 'unknown' | 'snooze'; snoozeDays?: number }) {
  return fetchApi<{ ok: boolean }>('POST', '/api/learning/swipe', input);
}

// ─── Review Feed (фаза 4) ──────────────────────────────────────────────────

export function reviewFeedNext(opts: { limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return fetchApi<ReviewFeedResponse>('GET', `/api/review-feed/next${qs ? '?' + qs : ''}`);
}

// Duels
export function duelCreate() {
  return fetchApi<DuelCreateResponse>('POST', '/api/duels/create');
}

export function duelJoin(id: number) {
  return fetchApi<Duel>('POST', `/api/duels/${id}/join`);
}

export function duelGet(id: number) {
  return fetchApi<Duel>('GET', `/api/duels/${id}`);
}

export function duelStart(id: number) {
  return fetchApi<QuizStartResponse>('POST', `/api/duels/${id}/start`);
}

export function duelFinish(id: number) {
  return fetchApi<DuelFinishResponse>('POST', `/api/duels/${id}/finish`);
}

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

export function getDifficultWords() {
  return fetchApi<DifficultWordsResponse>('GET', '/api/collections/difficult');
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

// Виртуальный ID для коллекции ошибок
export const ERRORS_COLLECTION_ID = 'errors' as const;

// Infinite Quiz
export function quizNext(
  excludeIds: number[] = [],
  collectionId?: number | typeof ERRORS_COLLECTION_ID,
  generatorMode?: string,
  recentGenerators: string[] = [],
  recentCorrect?: number,
  recentTotal?: number,
  questionIndex?: number,
) {
  const params = new URLSearchParams();
  if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','));
  if (collectionId) params.set('collectionId', String(collectionId));

  // Adaptive difficulty params
  if (recentCorrect !== undefined) params.set('recentCorrect', String(recentCorrect));
  if (recentTotal !== undefined) params.set('recentTotal', String(recentTotal));

  // Question index for grammar injection
  if (questionIndex !== undefined) params.set('questionIndex', String(questionIndex));

  // Определяем параметры генерации
  if (generatorMode === 'spelling' || generatorMode === 'match-pairs') {
    params.set('type', generatorMode);
  } else if (generatorMode && generatorMode !== 'auto') {
    // en-ru или ru-en — устанавливаем направление
    params.set('lang', generatorMode);
  }

  // История генераторов для авто-ротации (только в auto режиме)
  if (recentGenerators.length > 0 && (!generatorMode || generatorMode === 'auto')) {
    params.set('generators', recentGenerators.join(','));
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<{ question: QuizQuestion | null }>('GET', `/api/quiz/next${query}`);
}

export function quizAnswerInfinite(meaningId: number, selectedMeaningId: number | null, streak: number, doubleXpClaimed = false, skip = false) {
  return fetchApi<InfiniteAnswerResponse>('POST', '/api/quiz/answer-infinite', {
    meaningId,
    selectedMeaningId,
    streak,
    doubleXpClaimed,
    skip,
  });
}

export function quizAnswerGrammar(
  grammarType: string,
  answer: string,
  streak: number,
  params: { exerciseIndex?: number; blankIndex?: number; collocationIndex?: number; questionIndex?: number },
  skip = false,
) {
  return fetchApi<GrammarAnswerResponse>('POST', '/api/quiz/answer-grammar', {
    grammarType,
    answer,
    streak,
    ...params,
    skip,
  });
}

export function quizAnswerMatchPairs(results: Array<{ meaningId: number; isCorrect: boolean }>, streak: number, doubleXpClaimed = false) {
  return fetchApi<MatchPairsAnswerResponse>('POST', '/api/quiz/answer-match-pairs', {
    results,
    streak,
    doubleXpClaimed,
  });
}

export function getQuizHint(meaningId: number, level: number) {
  return fetchApi<{ hint: string | null; hasMore: boolean }>('GET', `/api/quiz/hint?meaningId=${meaningId}&level=${level}`);
}

// Leagues
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

// Grammar — Articles Quiz
import type {
  ArticleNextResponse,
  ArticleAnswerRequest,
  ArticleAnswerResponse,
  TenseNextResponse,
  TenseAnswerRequest,
  TenseAnswerResponse,
  CollocationNextResponse,
  CollocationAnswerRequest,
  CollocationAnswerResponse,
} from '@/types/grammar';

export function getNextArticleExercise(difficulty?: number) {
  const params = difficulty ? `?difficulty=${difficulty}` : '';
  return fetchApi<ArticleNextResponse>('GET', `/api/grammar/articles/next${params}`);
}

export function submitArticleAnswer(data: ArticleAnswerRequest) {
  return fetchApi<ArticleAnswerResponse>('POST', '/api/grammar/articles/answer', data);
}

// Grammar — Tenses Quiz
export function getNextTenseExercise(difficulty?: number) {
  const params = difficulty ? `?difficulty=${difficulty}` : '';
  return fetchApi<TenseNextResponse>('GET', `/api/grammar/tenses/next${params}`);
}

export function submitTenseAnswer(data: TenseAnswerRequest) {
  return fetchApi<TenseAnswerResponse>('POST', '/api/grammar/tenses/answer', data);
}

// Grammar — Collocations Quiz
export function getNextCollocationExercise(difficulty?: number) {
  const params = difficulty ? `?difficulty=${difficulty}` : '';
  return fetchApi<CollocationNextResponse>('GET', `/api/grammar/collocations/next${params}`);
}

export function submitCollocationAnswer(data: CollocationAnswerRequest) {
  return fetchApi<CollocationAnswerResponse>('POST', '/api/grammar/collocations/answer', data);
}

// Grammar — False Friends Quiz
export function getNextFalseFriend() {
  return fetchApi<{ question: import('@/types/grammar').FalseFriendQuestion; questionIndex: number }>(
    'GET',
    '/api/grammar/false-friends/next',
  );
}

export function submitFalseFriendAnswer(questionIndex: number, answer: string) {
  return fetchApi<import('@/types/grammar').FalseFriendAnswerResult>(
    'POST',
    '/api/grammar/false-friends/answer',
    { questionIndex, answer },
  );
}

// Reading
import type { ReadingNextResponse, ReadingAnswerRequest, ReadingAnswerResponse } from '@/types/reading';

export function getNextReadingPassage(level?: string) {
  const params = level ? `?level=${level}` : '';
  return fetchApi<ReadingNextResponse>('GET', `/api/reading/next${params}`);
}

export function submitReadingAnswer(data: ReadingAnswerRequest) {
  return fetchApi<ReadingAnswerResponse>('POST', '/api/reading/answer', data);
}

// Placement Test
export function placementStart(selfAssessment?: string) {
  return fetchApi<PlacementStartResponse>('POST', '/api/placement/start', selfAssessment ? { selfAssessment } : {});
}

export function placementAnswer(meaningId: number, selectedOption: string, answerTimeMs: number) {
  return fetchApi<PlacementAnswerResponse>('POST', '/api/placement/answer', { meaningId, selectedOption, answerTimeMs });
}

export function placementComplete() {
  return fetchApi<PlacementCompleteResponse>('POST', '/api/placement/complete');
}

export function placementFinalize(mode: 'all' | 'current-only') {
  return fetchApi<{ success: boolean }>('POST', '/api/placement/finalize', { mode });
}

export function placementSkip(selectedCefr: string) {
  return fetchApi<{ success: boolean }>('POST', '/api/placement/skip', { selectedCefr });
}
