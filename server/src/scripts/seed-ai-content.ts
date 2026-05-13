import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'ai-content');

type ContentEntry = {
  meaningId: number;
  word: string;
  translation: string;
  examples: { sentences: Array<{ en: string; ru: string; cefr: string }> };
  mnemonic: { association: string };
  hints: { hints: Array<{ level: number; text: string }> };
};

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Read all batch-*.json files
    const files = readdirSync(DATA_DIR)
      .filter(f => f.startsWith('batch-') && f.endsWith('.json'))
      .sort();

    if (files.length === 0) {
      console.log('No batch files found in', DATA_DIR);
      return;
    }

    console.log(`Found ${files.length} batch file(s)`);

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const file of files) {
      const filePath = join(DATA_DIR, file);
      const entries: ContentEntry[] = JSON.parse(readFileSync(filePath, 'utf-8'));
      console.log(`\nProcessing ${file}: ${entries.length} entries`);

      for (const entry of entries) {
        const contentTypes = [
          { type: 'examples', content: entry.examples },
          { type: 'mnemonic', content: entry.mnemonic },
          { type: 'hints', content: entry.hints },
        ] as const;

        for (const { type, content } of contentTypes) {
          try {
            await client.query(
              `INSERT INTO word_ai_content (meaning_id, content_type, content)
               VALUES ($1, $2, $3)
               ON CONFLICT (meaning_id, content_type) DO UPDATE SET content = $3`,
              [entry.meaningId, type, JSON.stringify(content)],
            );
            totalInserted++;
          } catch (err) {
            console.error(`  Error inserting ${type} for meaningId=${entry.meaningId} (${entry.word}):`, err);
            totalSkipped++;
          }
        }
      }
      console.log(`  Done: ${entries.length * 3} records processed`);
    }

    console.log(`\nTotal: ${totalInserted} inserted/updated, ${totalSkipped} errors`);

    // Stats
    const stats = await client.query(
      `SELECT content_type, count(*) as cnt FROM word_ai_content GROUP BY content_type ORDER BY content_type`,
    );
    console.log('\nDB stats:');
    for (const row of stats.rows) {
      console.log(`  ${row.content_type}: ${row.cnt}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
