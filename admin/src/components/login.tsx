import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';

const BOT_USERNAME = 'wordylang_bot';
const REDIRECT_URL = `${window.location.origin}/admin/login`;

export function Login() {
  const loginWithTelegram = useAuthStore((s) => s.loginWithTelegram);
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);
  const widgetRef = useRef<HTMLDivElement>(null);
  const processedRef = useRef(false);

  // Check URL params on mount — Telegram redirects back with auth data in query string
  useEffect(() => {
    if (processedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const hash = params.get('hash');
    if (id && hash) {
      processedRef.current = true;
      // Collect all telegram params from URL
      const data: Record<string, string> = {};
      for (const [key, value] of params.entries()) {
        data[key] = value;
      }
      // Clean URL
      window.history.replaceState({}, '', '/admin/login');
      loginWithTelegram(data);
    }
  }, [loginWithTelegram]);

  // Inject Telegram Login Widget with redirect mode
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-auth-url', REDIRECT_URL);
    script.setAttribute('data-request-access', 'write');

    if (widgetRef.current) {
      widgetRef.current.innerHTML = '';
      widgetRef.current.appendChild(script);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Wordy Admin</h1>
        <p className="mb-8 text-center text-sm text-[var(--muted-foreground)]">
          Войдите через Telegram для доступа к панели управления
        </p>

        {/* Telegram Widget renders its own button here */}
        <div className="flex justify-center" ref={widgetRef} />

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
