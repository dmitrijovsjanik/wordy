import pg from 'pg';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Count qualifying meanings
    const countRes = await client.query(`
      SELECT count(*) as cnt
      FROM word_meanings wm
      JOIN words w ON wm.word_id = w.id
      WHERE wm.popularity_rank <= 3
        AND (wm.frequency >= 5 OR wm.frequency IS NULL)
    `);
    console.log('Total qualifying meanings:', countRes.rows[0].cnt);

    // Get first 50 for preview
    const res = await client.query(`
      SELECT wm.id, w.text, wm.translation, wm.part_of_speech as pos, w.frequency_rank, wm.cefr
      FROM word_meanings wm
      JOIN words w ON wm.word_id = w.id
      WHERE wm.popularity_rank <= 3
        AND (wm.frequency >= 5 OR wm.frequency IS NULL)
      ORDER BY w.frequency_rank ASC NULLS LAST
      LIMIT 50
    `);

    for (const row of res.rows) {
      console.log(`${row.id}\t${row.text}\t[${row.pos}]\t${row.translation}\t${row.cefr}\tfreq=${row.frequency_rank}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
