import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from '../schema.js';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

async function migrateLastLoginDate() {
  console.log('Migrating lastLoginDate from lastActivityAt...');

  await db
    .update(users)
    .set({ lastLoginDate: sql`last_activity_at` })
    .where(sql`last_login_date IS NULL AND last_activity_at IS NOT NULL`);

  console.log('Migration complete!');
  await pool.end();
}

migrateLastLoginDate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
