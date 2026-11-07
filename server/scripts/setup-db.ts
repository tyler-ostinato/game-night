// Creates the tables (safe to re-run). Usage: npm run db:setup [-- --test]
import '../src/env.js';
import { readFileSync } from 'node:fs';

if (process.argv.includes('--test')) process.env.GAMENIGHT_TEST = '1';
const { sql } = await import('../src/db.js'); // after the line above, so --test picks the test database

await sql.unsafe(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
console.log('Tables ready.');
await sql.end();
