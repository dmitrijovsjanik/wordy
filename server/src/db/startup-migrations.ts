/**
 * Одноразовые миграции, выполняемые при старте сервера.
 * Каждая миграция имеет уникальный ключ и выполняется только один раз.
 */

import { db } from './index.js';
import { sql } from 'drizzle-orm';

type Migration = {
  key: string;
  description: string;
  run: () => Promise<void>;
};

const migrations: Migration[] = [
  {
    key: 'recalculate-levels-pow-2.2',
    description: 'Пересчёт уровней по новой формуле level = floor((xp/100)^(1/2.2)) + 1',
    run: async () => {
      await db.execute(sql`
        UPDATE users SET level = CASE
          WHEN xp < 100 THEN 1
          ELSE floor(power(xp / 100.0, 1.0 / 2.2)) + 1
        END
      `);
    },
  },
];

export async function runStartupMigrations(): Promise<void> {
  // Создаём таблицу для отслеживания миграций (если не существует)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS _startup_migrations (
      key VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  for (const migration of migrations) {
    // Проверяем, была ли миграция уже применена
    const result = await db.execute(
      sql`SELECT 1 FROM _startup_migrations WHERE key = ${migration.key}`
    );

    if (result.rows.length > 0) {
      continue;
    }

    console.log(`[migration] Applying: ${migration.key} — ${migration.description}`);
    await migration.run();

    // Записываем, что миграция применена
    await db.execute(
      sql`INSERT INTO _startup_migrations (key) VALUES (${migration.key})`
    );
    console.log(`[migration] Done: ${migration.key}`);
  }
}
