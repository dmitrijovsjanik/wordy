import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';

export function Login() {
  const loginWithTelegram = useAuthStore((s) => s.loginWithTelegram);
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);
  const processedRef = useRef(false);

  // On mount: check if Telegram redirected back with auth data
  useEffect(() => {
    if (processedRef.current) return;

    console.log('[TG Auth] Page loaded, checking for auth data...');
    console.log('[TG Auth] Full URL:', window.location.href);
    console.log('[TG Auth] Hash:', window.location.hash);
    console.log('[TG Auth] Search:', window.location.search);

    let data: Record<string, string> | null = null;

    // Format 1: hash fragment #tgAuthResult=<url-encoded-json>
    const hash = window.location.hash;
    if (hash.startsWith('#tgAuthResult=')) {
      const encoded = hash.slice('#tgAuthResult='.length);
      console.log('[TG Auth] Found tgAuthResult, encoded:', encoded);
      try {
        const decoded = decodeURIComponent(encoded);
        console.log('[TG Auth] URL-decoded:', decoded);
        const parsed = JSON.parse(decoded) as Record<string, unknown>;
        console.log('[TG Auth] Parsed JSON:', parsed);
        data = {};
        for (const [key, value] of Object.entries(parsed)) {
          data[key] = String(value);
        }
      } catch (e) {
        console.log('[TG Auth] URL-decode failed, trying base64...', e);
        try {
          const decoded = atob(encoded);
          console.log('[TG Auth] Base64-decoded:', decoded);
          const parsed = JSON.parse(decoded) as Record<string, unknown>;
          console.log('[TG Auth] Parsed JSON:', parsed);
          data = {};
          for (const [key, value] of Object.entries(parsed)) {
            data[key] = String(value);
          }
        } catch (e2) {
          console.error('[TG Auth] Both decode attempts failed', e2);
        }
      }
    }

    // Format 2: query params ?id=...&hash=...
    if (!data) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      const authHash = params.get('hash');
      console.log('[TG Auth] Query params - id:', id, 'hash:', authHash);
      if (id && authHash) {
        data = {};
        for (const [key, value] of params.entries()) {
          data[key] = value;
        }
        console.log('[TG Auth] Data from query params:', data);
      }
    }

    if (data) {
      console.log('[TG Auth] Sending to server:', data);
      processedRef.current = true;
      window.history.replaceState({}, '', '/admin/login');
      loginWithTelegram(data);
    } else {
      console.log('[TG Auth] No auth data found on this page load');
    }
  }, [loginWithTelegram]);

  // Fetch numeric bot ID from server, then redirect to Telegram OAuth
  const handleLogin = async () => {
    try {
      console.log('[TG Auth] Fetching bot config...');
      const res = await fetch('/api/admin/auth/config');
      const config = (await res.json()) as { botId: string };
      console.log('[TG Auth] Bot config:', config);
      if (!config.botId) {
        console.error('[TG Auth] No bot ID returned');
        return;
      }
      const returnTo = `${window.location.origin}/admin/login`;
      const origin = window.location.origin;
      const url =
        `https://oauth.telegram.org/auth?bot_id=${config.botId}` +
        `&origin=${encodeURIComponent(origin)}` +
        `&request_access=write` +
        `&return_to=${encodeURIComponent(returnTo)}`;
      console.log('[TG Auth] Redirecting to:', url);
      window.location.href = url;
    } catch (err) {
      console.error('[TG Auth] Failed to get bot config', err);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Wordy Admin</h1>
        <p className="mb-8 text-center text-sm text-[var(--muted-foreground)]">
          Войдите через Telegram для доступа к панели управления
        </p>

        <div className="flex justify-center">
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="bg-[#54a9eb] hover:bg-[#4a96d2] text-white font-medium px-6 py-5 text-base"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.442-.751-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Войти через Telegram
          </Button>
        </div>

        {isLoading && (
          <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
            Авторизация...
          </p>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
