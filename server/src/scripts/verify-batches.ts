import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'ai-content');

type Entry = { meaningId: number; word: string; translation: string };

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const files = readdirSync(DATA_DIR).filter(f => f.startsWith('batch-') && f.endsWith('.json')).sort();

    for (const file of files) {
      const entries: Entry[] = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8'));
      const ids = entries.map(e => e.meaningId);

      const res = await client.query(
        `SELECT wm.id, w.text, wm.translation FROM word_meanings wm JOIN words w ON wm.word_id = w.id WHERE wm.id = ANY($1)`,
        [ids],
      );
      const dbMap = new Map(res.rows.map((r: { id: number; text: string; translation: string }) => [r.id, r]));

      const missing: number[] = [];
      const mismatches: string[] = [];

      for (const entry of entries) {
        const row = dbMap.get(entry.meaningId);
        if (!row) {
          missing.push(entry.meaningId);
        } else if (row.text !== entry.word || row.translation !== entry.translation) {
          mismatches.push(`  id=${entry.meaningId}: DB="${row.text}/${row.translation}" vs file="${entry.word}/${entry.translation}"`);
        }
      }

      console.log(`${file}: ${entries.length} entries`);
      if (missing.length > 0) console.log(`  MISSING IDs: ${missing.join(', ')}`);
      if (mismatches.length > 0) {
        console.log(`  MISMATCHES:`);
        mismatches.forEach(m => console.log(m));
      }
      if (missing.length === 0 && mismatches.length === 0) {
        console.log(`  All OK`);
      }
    }

    // DB stats
    const stats = await client.query(`SELECT content_type, count(*) as cnt FROM word_ai_content GROUP BY content_type`);
    console.log('\nDB word_ai_content stats:');
    for (const row of stats.rows) {
      console.log(`  ${row.content_type}: ${row.cnt}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
