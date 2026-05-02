import pg from 'pg';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE ai_content_type AS ENUM ('examples', 'mnemonic', 'hints');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS word_ai_content (
        id SERIAL PRIMARY KEY,
        meaning_id INTEGER NOT NULL REFERENCES word_meanings(id) ON DELETE CASCADE,
        content_type ai_content_type NOT NULL,
        content JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS word_ai_content_meaning_type_uniq
      ON word_ai_content (meaning_id, content_type);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS word_ai_content_meaning_idx
      ON word_ai_content (meaning_id);
    `);

    console.log('Table word_ai_content created successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
