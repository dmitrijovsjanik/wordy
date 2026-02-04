// Base word seeding is handled by NGSL import (ngsl-import.ts) and enrichment (enrich.ts).
// This file is kept as a placeholder for the `npm run db:seed` command.
// To seed words: npm run db:ngsl-import && npm run db:enrich

console.log('Base word seed has been removed. Use the NGSL pipeline instead:');
console.log('  1. npm run db:ngsl-import   — import words with frequency ranks');
console.log('  2. npm run db:enrich        — add translations, CEFR levels, examples');
console.log('  3. npm run db:seed-collections — generate system collections');
