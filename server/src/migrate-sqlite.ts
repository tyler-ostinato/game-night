// One-off: copies data/gamenight.db and data/images into Postgres + Vercel Blob.
// Refuses to run if the Postgres database already has games, so it can't double up.
import './env.js';
import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { put } from '@vercel/blob';
import { sql, resetSequences } from './db.js';

await sql.unsafe(readFileSync(new URL('schema.sql', import.meta.url), 'utf8'));
if ((await sql`SELECT 1 FROM games LIMIT 1`).length) {
  console.error('Postgres already has games in it; not migrating again.');
  process.exit(1);
}

const lite = new Database(new URL('../../data/gamenight.db', import.meta.url).pathname, { readonly: true });
const rows = (table: string) => lite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];

const games = rows('games');
for (const g of games) {
  if (!g.image) continue;
  const file = new URL(`../../data/images/${g.image}`, import.meta.url);
  if (!existsSync(file)) { console.warn(`Missing cover ${g.image}, skipping.`); g.image = null; continue; }
  const ext = String(g.image).split('.').pop()!;
  const type = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' }[ext];
  const { url } = await put(`covers/${g.id}.${ext}`, readFileSync(file), { access: 'public', contentType: type, addRandomSuffix: true, token: process.env.BLOB_READ_WRITE_TOKEN });
  g.image = url;
  console.log(`Uploaded cover for ${g.name}`);
}

await sql.begin(async tx => {
  // Parents before children, so foreign keys are satisfied.
  const copy = async (table: string, data: Record<string, unknown>[]) => {
    for (let i = 0; i < data.length; i += 500) await tx`INSERT INTO ${tx(table)} ${tx(data.slice(i, i + 500))}`;
    console.log(`${table}: ${data.length}`);
  };
  await copy('players', rows('players'));
  await copy('games', games);
  await copy('sessions', rows('sessions'));
  await copy('plays', rows('plays'));
  await copy('play_players', rows('play_players'));
  await copy('expansions', rows('expansions'));
  await copy('play_expansions', rows('play_expansions'));
  await copy('auth_tokens', rows('auth_tokens'));
  await resetSequences(tx);
});
console.log('Done.');
await sql.end();
