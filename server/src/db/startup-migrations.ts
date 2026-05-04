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
  {
    key: 'remove-divisions-set-1',
    description: 'Убираем дивизионы из лиг — устанавливаем division=1 для всех',
    run: async () => {
      await db.execute(sql`
        UPDATE user_league_progress SET division = 1 WHERE division != 1
      `);
    },
  },
  {
    key: 'reset-season-to-zero',
    description: 'Сброс номера текущего сезона на 0',
    run: async () => {
      await db.execute(sql`
        UPDATE league_seasons SET week_number = 0 WHERE is_active = true
      `);
    },
  },
  {
    key: 'srs-redesign-migrate-stages',
    description: 'Конвертация srsStage 0-6 в новую модель 0-3 + hasPenalty + reviewStage',
    run: async () => {
      // user_word_progress
      await db.execute(sql`
        UPDATE user_word_progress SET
          has_penalty = CASE WHEN srs_stage < 0 THEN true ELSE false END,
          review_stage = CASE WHEN srs_stage >= 6 THEN 2 ELSE 0 END,
          srs_stage = CASE
            WHEN srs_stage < 0 THEN 0
            WHEN srs_stage <= 0 THEN 0
            WHEN srs_stage <= 2 THEN 1
            WHEN srs_stage <= 4 THEN 2
            ELSE 3
          END
      `);

      // user_custom_word_progress
      await db.execute(sql`
        UPDATE user_custom_word_progress SET
          has_penalty = CASE WHEN srs_stage < 0 THEN true ELSE false END,
          review_stage = CASE WHEN srs_stage >= 6 THEN 2 ELSE 0 END,
          srs_stage = CASE
            WHEN srs_stage < 0 THEN 0
            WHEN srs_stage <= 0 THEN 0
            WHEN srs_stage <= 2 THEN 1
            WHEN srs_stage <= 4 THEN 2
            ELSE 3
          END
      `);
    },
  },
  {
    key: 'reset-incorrect-count',
    description: 'Сброс incorrectCount — теперь сбрасывается при правильном ответе, старые данные нужно почистить',
    run: async () => {
      await db.execute(sql`UPDATE user_word_progress SET incorrect_count = 0 WHERE incorrect_count > 0`);
      await db.execute(sql`UPDATE user_custom_word_progress SET incorrect_count = 0 WHERE incorrect_count > 0`);
    },
  },
  {
    key: 'add-platform-id-check-constraint',
    description: 'CHECK constraint: у пользователя должен быть хотя бы один platform ID (telegram_id или vk_id)',
    run: async () => {
      await db.execute(sql`
        ALTER TABLE users ADD CONSTRAINT users_has_platform_id
          CHECK (telegram_id IS NOT NULL OR vk_id IS NOT NULL)
      `);
    },
  },
  {
    key: 'set-default-cefr-a2',
    description: 'Дефолт estimated_cefr=a2 для пользователей с null (после удаления Onboarding/Placement)',
    run: async () => {
      await db.execute(sql`
        UPDATE users SET estimated_cefr = 'a2' WHERE estimated_cefr IS NULL
      `);
    },
  },
  {
    key: 'drop-onboarding-completed-at',
    description: 'Удаление колонки users.onboarding_completed_at (после удаления Onboarding/Placement)',
    run: async () => {
      await db.execute(sql`
        ALTER TABLE users DROP COLUMN IF EXISTS onboarding_completed_at
      `);
    },
  },
  {
    key: 'drop-placement-results',
    description: 'Удаление таблицы placement_results (после удаления Onboarding/Placement)',
    run: async () => {
      await db.execute(sql`DROP TABLE IF EXISTS placement_results`);
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
