import type {
  GeneralStats,
  ActivityStats,
  EconomyStats,
  SrsStats,
  UsersListResponse,
  UserDetailResponse,
  UserActivityResponse,
  UserWordsResponse,
  AdminInfo,
} from '@/types/admin';

const TOKEN_KEY = 'wordy_admin_token';
const ADMIN_KEY = 'wordy_admin_info';

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export function getAdminInfo(): AdminInfo | null {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminInfo;
  } catch {
    return null;
  }
}

export function setAdminInfo(info: AdminInfo): void {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(info));
}

async function fetchApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAdminToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    removeAdminToken();
    window.location.href = '/admin/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error((data as { error?: string }).error ?? 'Неизвестная ошибка');
  }

  return res.json() as Promise<T>;
}

// Auth
export async function adminLoginTelegram(data: Record<string, string>) {
  console.log('[TG Auth API] Sending to /api/admin/auth/telegram:', JSON.stringify(data));
  try {
    const result = await fetchApi<{ token: string; admin: AdminInfo }>('POST', '/api/admin/auth/telegram', data);
    console.log('[TG Auth API] Success, admin:', result.admin);
    return result;
  } catch (err) {
    console.error('[TG Auth API] Failed:', err);
    throw err;
  }
}

// Dashboard
export function getGeneralStats() {
  return fetchApi<GeneralStats>('GET', '/api/admin/stats/general');
}

export function getActivityStats(days = 30) {
  return fetchApi<ActivityStats>('GET', `/api/admin/stats/activity?days=${days}`);
}

export function getEconomyStats() {
  return fetchApi<EconomyStats>('GET', '/api/admin/stats/economy');
}

export function getSrsStats() {
  return fetchApi<SrsStats>('GET', '/api/admin/stats/srs');
}

// Users
export function getUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: string;
}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.sort) qs.set('sort', params.sort);
  if (params.order) qs.set('order', params.order);
  return fetchApi<UsersListResponse>('GET', `/api/admin/users?${qs}`);
}

export function getUserDetail(id: number) {
  return fetchApi<UserDetailResponse>('GET', `/api/admin/users/${id}`);
}

export function getUserActivity(id: number, limit = 50) {
  return fetchApi<UserActivityResponse>('GET', `/api/admin/users/${id}/activity?limit=${limit}`);
}

export function getUserWords(id: number) {
  return fetchApi<UserWordsResponse>('GET', `/api/admin/users/${id}/words`);
}

export function giveGems(id: number, amount: number, reason: string) {
  return fetchApi<{ success: boolean; newGems: number }>('POST', `/api/admin/users/${id}/give-gems`, { amount, reason });
}
