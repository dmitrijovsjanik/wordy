import { useEffect, type ReactNode } from 'react';
import { platformBridge } from '@/lib/platform-bridge';
import { useUserStore } from '@/stores/user-store';

type PlatformProviderProps = {
  children: ReactNode;
};

export function TelegramProvider({ children }: PlatformProviderProps) {
  const isLoading = useUserStore((s) => s.isLoading);
  const error = useUserStore((s) => s.error);
  const init = useUserStore((s) => s.init);

  useEffect(() => {
    platformBridge.expand();
    platformBridge.requestFullscreen();
    platformBridge.disableVerticalSwipes();
    init();
  }, [init]);

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Wordy</div>
          <div className="mt-2 text-sm text-muted-foreground">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg font-medium text-destructive">{error}</div>
          <button
            className="mt-4 rounded-lg bg-primary px-6 py-3 text-primary-foreground"
            onClick={init}
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
