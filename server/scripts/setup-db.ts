// Creates the tables (safe to re-run). Usage: npm run db:setup [-- --test]
import '../src/env.js';

if (process.argv.includes('--test')) process.env.GAMENIGHT_TEST = '1';
const { sql, ensureSchema } = await import('../src/db.js'); // after the line above, so --test picks the test database

await ensureSchema();
console.log('Tables ready.');
await sql.end();
