import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { words } from '../schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

type NgslEntry = {
  text: string;
  rank: number;
};

function parseNgslCsv(filePath: string): NgslEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');

  // Skip header: "Lemma,SFI Rank,SFI,Adjusted Frequency per Million (U)"
  const entries: NgslEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    const text = parts[0].trim().toLowerCase();
    const rank = parseInt(parts[1], 10);

    if (!text || isNaN(rank)) continue;

    // Пропускаем служебные слова (артикли, предлоги, местоимения до ранга ~50)
    // Они не подходят для квизов "слово → перевод"
    entries.push({ text, rank });
  }

  return entries;
}

async function importNgsl() {
  const csvPath = path.join(__dirname, 'ngsl-raw.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('NGSL CSV not found at', csvPath);
    console.error('Download it from https://www.newgeneralservicelist.com/new-general-service-list');
    process.exit(1);
  }

  const entries = parseNgslCsv(csvPath);
  console.log(`Parsed ${entries.length} words from NGSL CSV\n`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    const [existing] = await db
      .select()
      .from(words)
      .where(eq(words.text, entry.text))
      .limit(1);

    if (existing) {
      // Обновляем frequencyRank если его не было
      if (existing.frequencyRank === null) {
        await db
          .update(words)
          .set({ frequencyRank: entry.rank })
          .where(eq(words.id, existing.id));
        updated++;
      } else {
        skipped++;
      }
    } else {
      await db.insert(words).values({
        text: entry.text,
        frequencyRank: entry.rank,
      });
      inserted++;
    }

    if ((inserted + updated + skipped) % 200 === 0) {
      console.log(`Progress: ${inserted + updated + skipped}/${entries.length}`);
    }
  }

  console.log(`\nDone! Inserted: ${inserted}, Updated rank: ${updated}, Skipped: ${skipped}`);
  console.log(`Total words in NGSL: ${entries.length}`);
  await pool.end();
}

importNgsl().catch((err) => {
  console.error('NGSL import failed:', err);
  process.exit(1);
});
