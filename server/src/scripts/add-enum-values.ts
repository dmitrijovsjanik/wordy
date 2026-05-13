import pg from 'pg';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("ALTER TYPE ai_content_type ADD VALUE IF NOT EXISTS 'grammar'");
  await pool.query("ALTER TYPE ai_content_type ADD VALUE IF NOT EXISTS 'common_errors'");
  console.log('Done: added grammar and common_errors to ai_content_type enum');
  await pool.end();
}

main().catch(console.error);
