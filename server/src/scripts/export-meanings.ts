import pg from 'pg';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT wm.id as "meaningId", w.text as word, wm.translation, wm.part_of_speech as pos,
             w.frequency_rank as "freqRank", wm.popularity_rank as "popRank", wm.cefr
      FROM word_meanings wm
      JOIN words w ON wm.word_id = w.id
      WHERE wm.popularity_rank <= 3
        AND (wm.frequency >= 5 OR wm.frequency IS NULL)
      ORDER BY w.frequency_rank ASC NULLS LAST, wm.popularity_rank ASC
    `);

    const outPath = join(__dirname, '..', 'data', 'ai-content', 'all-meanings.json');
    writeFileSync(outPath, JSON.stringify(res.rows, null, 2));
    console.log(`Exported ${res.rows.length} meanings to ${outPath}`);

    // Stats
    const byPos: Record<string, number> = {};
    for (const r of res.rows) {
      byPos[r.pos] = (byPos[r.pos] ?? 0) + 1;
    }
    console.log('By POS:', byPos);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
