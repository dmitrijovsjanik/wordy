import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

declare global {
  interface Window {
    onTelegramAuth: (user: Record<string, string>) => void;
  }
}

const BOT_USERNAME = 'wordylang_bot';

export function Login() {
  const loginWithTelegram = useAuthStore((s) => s.loginWithTelegram);
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [widgetFailed, setWidgetFailed] = useState(false);

  useEffect(() => {
    // Telegram Login Widget callback
    window.onTelegramAuth = (user: Record<string, string>) => {
      loginWithTelegram(user);
    };

    // Inject Telegram Login Widget script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');

    // If widget doesn't render within 3s, show fallback message
    const timer = setTimeout(() => {
      if (!widgetRef.current?.querySelector('iframe')) {
        setWidgetFailed(true);
      }
    }, 3000);

    if (widgetRef.current) {
      widgetRef.current.innerHTML = '';
      widgetRef.current.appendChild(script);
    }

    return () => {
      clearTimeout(timer);
      delete (window as Partial<typeof window>).onTelegramAuth;
    };
  }, [loginWithTelegram]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Wordy Admin</h1>
        <p className="mb-8 text-center text-sm text-[var(--muted-foreground)]">
          Войдите через Telegram для доступа к панели управления
        </p>

        {/* Telegram Widget renders its own button here */}
        <div className="flex justify-center" ref={widgetRef} />

        {widgetFailed && (
          <p className="mt-4 text-center text-xs text-[var(--muted-foreground)]">
            Виджет не загрузился. Убедитесь, что домен добавлен в @BotFather → /setdomain
          </p>
        )}

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
