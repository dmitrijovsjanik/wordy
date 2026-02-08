import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'chunk-reload';

/**
 * React.lazy с автоматической перезагрузкой при ошибке загрузки чанка.
 *
 * После деплоя хеши чанков меняются, а закешированный index.html
 * ссылается на старые файлы (404). Retry того же URL бесполезен —
 * нужно перезагрузить страницу, чтобы получить новый index.html.
 *
 * Чтобы избежать бесконечного цикла перезагрузок, используется
 * sessionStorage-флаг: перезагружаемся только один раз.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      // Если уже перезагружались — не зацикливаемся
      const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      }
      throw error;
    }
  });
}
