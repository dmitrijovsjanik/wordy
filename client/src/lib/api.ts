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
  MarketplaceCollection,
  LibraryCollection,
  CollectionDetail,
  DifficultWordsResponse,
  AllWordsResponse,
  QuizQuestion,
  InfiniteAnswerResponse,
  DictionaryLookupResult,
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

export function authDev() {
  return fetchApi<AuthResponse>('GET', '/api/auth/dev');
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

export function updateLanguages(nativeLanguage: string, learningLanguage: string) {
  return fetchApi<{ nativeLanguage: string; learningLanguage: string }>(
    'PUT',
    '/api/users/me/languages',
    { nativeLanguage, learningLanguage },
  );
}

// Collections
export function getMarketplace() {
  return fetchApi<{ collections: MarketplaceCollection[] }>('GET', '/api/collections/marketplace');
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

// Infinite Quiz
export function quizNext(excludeIds: number[] = [], collectionId?: number) {
  const params = new URLSearchParams();
  if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','));
  if (collectionId) params.set('collectionId', String(collectionId));
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<{ question: QuizQuestion | null }>('GET', `/api/quiz/next${query}`);
}

export function quizAnswerInfinite(meaningId: number, selectedMeaningId: number | null) {
  return fetchApi<InfiniteAnswerResponse>('POST', '/api/quiz/answer-infinite', {
    meaningId,
    selectedMeaningId,
  });
}
