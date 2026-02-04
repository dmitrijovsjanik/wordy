import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const client = await pool.connect();

// Delete old topic collections (cascade will clean collection_words)
const r1 = await client.query(`
  DELETE FROM collections WHERE title IN (
    SELECT title FROM topics
  ) AND type = 'system'
`);
console.log('Deleted old topic collections:', r1.rowCount);

// Delete old hardcoded collections
const r2 = await client.query(`
  DELETE FROM collections WHERE title IN (
    'Базовые слова', 'Слова с несколькими значениями', 'Продвинутая лексика', 'Академический английский'
  ) AND type = 'system'
`);
console.log('Deleted old hardcoded collections:', r2.rowCount);

client.release();
await pool.end();
