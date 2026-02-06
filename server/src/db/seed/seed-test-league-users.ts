import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc } from 'drizzle-orm';
import {
  users,
  userLeagueProgress,
  userSeasonStats,
  leagueSeasons,
} from '../schema.js';
import type { LeagueTier } from '../../config/league-config.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

// Русские имена для тестовых пользователей
const RUSSIAN_NAMES = [
  'Алексей', 'Мария', 'Дмитрий', 'Анна', 'Сергей',
  'Елена', 'Андрей', 'Ольга', 'Михаил', 'Наталья',
  'Иван', 'Татьяна', 'Павел', 'Екатерина', 'Николай',
  'Светлана', 'Артём', 'Юлия', 'Владимир', 'Ирина',
  'Максим', 'Виктория', 'Александр', 'Полина', 'Роман',
  'Дарья', 'Егор', 'Алина', 'Кирилл', 'Вероника',
];

// Сколько пользователей генерировать
const TEST_USERS_COUNT = 20;

// Диапазон LP для тестовых пользователей (случайное распределение)
const LP_MIN = 500;
const LP_MAX = 8000;

async function seedTestLeagueUsers() {
  console.log('Seeding test league users...');

  // Найти активный сезон
  const [activeSeason] = await db
    .select()
    .from(leagueSeasons)
    .where(eq(leagueSeasons.isActive, true))
    .limit(1);

  if (!activeSeason) {
    console.error('No active season found! Start the server first to create a season.');
    await pool.end();
    process.exit(1);
  }

  console.log(`Active season: week ${activeSeason.weekNumber}, year ${activeSeason.year}`);

  // Найти реального пользователя для определения его лиги
  const [realUser] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      tier: userLeagueProgress.tier,
      division: userLeagueProgress.division,
    })
    .from(users)
    .leftJoin(userLeagueProgress, eq(users.id, userLeagueProgress.userId))
    .orderBy(desc(users.lastActivityAt))
    .limit(1);

  if (!realUser) {
    console.error('No real user found in database!');
    await pool.end();
    process.exit(1);
  }

  const targetTier = (realUser.tier ?? 'bronze') as LeagueTier;
  const targetDivision = realUser.division ?? 3;

  console.log(`Found user "${realUser.firstName}" in ${targetTier} division ${targetDivision}`);
  console.log(`Creating ${TEST_USERS_COUNT} test users in the same league...`);

  // Генерируем уникальные telegram_id (отрицательные, чтобы не пересекаться с реальными)
  const baseTelegramId = -1000000000n;

  for (let i = 0; i < TEST_USERS_COUNT; i++) {
    const telegramId = baseTelegramId - BigInt(i);
    const firstName = RUSSIAN_NAMES[i % RUSSIAN_NAMES.length];
    const username = `test_user_${i + 1}`;

    // Проверяем, существует ли уже
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.telegramId, telegramId))
      .limit(1);

    let userId: number;

    if (existing) {
      userId = existing.id;
      console.log(`  User "${firstName}" already exists, updating stats...`);
    } else {
      // Создаём пользователя
      const [newUser] = await db
        .insert(users)
        .values({
          telegramId,
          firstName,
          username,
          xp: Math.floor(Math.random() * 10000),
          level: Math.floor(Math.random() * 10) + 1,
          streakDays: Math.floor(Math.random() * 14),
        })
        .returning({ id: users.id });

      userId = newUser.id;

      // Создаём league progress
      await db.insert(userLeagueProgress).values({
        userId,
        tier: targetTier,
        division: targetDivision,
      });

      console.log(`  Created user "${firstName}"`);
    }

    // Создаём или обновляем season stats
    const lp = Math.floor(Math.random() * (LP_MAX - LP_MIN)) + LP_MIN;
    const correctAnswers = Math.floor(lp / 100) + Math.floor(Math.random() * 20);

    const [existingStat] = await db
      .select()
      .from(userSeasonStats)
      .where(eq(userSeasonStats.userId, userId))
      .limit(1);

    if (existingStat) {
      await db
        .update(userSeasonStats)
        .set({
          leaguePoints: lp,
          correctAnswers,
          updatedAt: new Date(),
        })
        .where(eq(userSeasonStats.id, existingStat.id));
    } else {
      await db.insert(userSeasonStats).values({
        userId,
        seasonId: activeSeason.id,
        leaguePoints: lp,
        correctAnswers,
        tierAtStart: targetTier,
        divisionAtStart: targetDivision,
      });
    }

    console.log(`    LP: ${lp}`);
  }

  console.log('\nTest league users seed complete!');
  await pool.end();
}

seedTestLeagueUsers().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
