import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
export const db = new Database(process.env.GAMENIGHT_DB ?? path.join(dir, '../../data/gamenight.db'));
db.pragma('foreign_keys = ON');
db.exec(readFileSync(path.join(dir, 'schema.sql'), 'utf8'));

// Columns added after the first release. Live sessions have started_at; legacy ones don't.
const sessionCols = (db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[]).map(c => c.name);
if (!sessionCols.includes('started_at')) db.exec('ALTER TABLE sessions ADD COLUMN started_at TEXT');
if (!sessionCols.includes('ended_at')) db.exec('ALTER TABLE sessions ADD COLUMN ended_at TEXT');
const gameCols = (db.prepare('PRAGMA table_info(games)').all() as { name: string }[]).map(c => c.name);
if (!gameCols.includes('image')) db.exec('ALTER TABLE games ADD COLUMN image TEXT');

export function expansionIdFor(gameId: number, name: string): number {
  db.prepare('INSERT OR IGNORE INTO expansions (game_id, name) VALUES (?, ?)').run(gameId, name);
  return (db.prepare('SELECT id FROM expansions WHERE game_id = ? AND name = ?').get(gameId, name) as { id: number }).id;
}

// Move the old pipe-separated plays.expansions text into the expansions tables.
const unlinked = db.prepare(`SELECT id, game_id, expansions FROM plays
  WHERE expansions IS NOT NULL AND id NOT IN (SELECT play_id FROM play_expansions)`).all() as { id: number; game_id: number; expansions: string }[];
db.transaction(() => {
  for (const p of unlinked) {
    for (const name of p.expansions.split('|').map(s => s.trim()).filter(Boolean)) {
      db.prepare('INSERT OR IGNORE INTO play_expansions (play_id, expansion_id) VALUES (?, ?)').run(p.id, expansionIdFor(p.game_id, name));
    }
  }
})();

export function idFor(table: 'players' | 'games', name: string): number {
  db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`).run(name);
  return (db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name) as { id: number }).id;
}
