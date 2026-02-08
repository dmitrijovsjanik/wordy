import { lazy, type ComponentType } from 'react';

/**
 * React.lazy с автоматическим retry при ошибке загрузки чанка.
 * Помогает при нестабильной сети или проблемах кэширования WebView.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
) {
  return lazy(() => retryImport(factory, retries));
}

async function retryImport<T>(
  factory: () => Promise<T>,
  retries: number,
): Promise<T> {
  try {
    return await factory();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((r) => setTimeout(r, 1000));
    return retryImport(factory, retries - 1);
  }
}
