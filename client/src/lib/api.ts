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
