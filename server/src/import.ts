// Import of data/results.csv. Re-running replaces legacy data only; live sessions are kept.
import { readFileSync } from 'node:fs';
import { db, idFor, expansionIdFor } from './db.js';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// MM/DD/YY -> YYYY-MM-DD
const isoDate = (d: string) => {
  const [m, day, y] = d.split('/');
  return `20${y.padStart(2, '0')}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const [header, ...rows] = parseCsv(readFileSync(new URL('../../data/results.csv', import.meta.url), 'utf8'));
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const get = (r: string[], k: string) => r[col[k]]?.trim() || null;

db.transaction(() => {
  db.exec(`DELETE FROM play_expansions WHERE play_id IN (SELECT id FROM plays WHERE legacy = 1);
    DELETE FROM play_players WHERE play_id IN (SELECT id FROM plays WHERE legacy = 1);
    DELETE FROM plays WHERE legacy = 1; DELETE FROM sessions WHERE legacy = 1;`);
  const insSession = db.prepare('INSERT OR IGNORE INTO sessions (id, date, legacy) VALUES (?, ?, ?)');
  const insPlay = db.prepare('INSERT INTO plays (id, session_id, game_id, expansions, end_time, notes, legacy) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insPP = db.prepare(`INSERT INTO play_players (play_id, player_id, score, placement) VALUES (?, ?, ?, ?)
    ON CONFLICT DO UPDATE SET score = coalesce(excluded.score, score), placement = coalesce(excluded.placement, placement)`);

  for (const r of rows) {
    const legacy = get(r, 'legacy') === '1' ? 1 : 0;
    const playId = Number(get(r, 'game_id'));
    insSession.run(Number(get(r, 'session_id')), isoDate(get(r, 'date')!), legacy);
    const gameId = idFor('games', get(r, 'game')!);
    insPlay.run(playId, Number(get(r, 'session_id')), gameId, get(r, 'expansion'), get(r, 'time'), get(r, 'notes'), legacy);
    for (const name of (get(r, 'expansion') ?? '').split('|').filter(Boolean)) {
      db.prepare('INSERT INTO play_expansions (play_id, expansion_id) VALUES (?, ?)').run(playId, expansionIdFor(gameId, name));
    }

    const winner = get(r, 'player');
    const score = get(r, 'score');
    const placement = get(r, 'placement');
    for (const name of (get(r, 'attendance') ?? '').split('|').filter(Boolean)) {
      if (name !== winner) insPP.run(playId, idFor('players', name), null, null);
    }
    if (winner) insPP.run(playId, idFor('players', winner), score ? Number(score) : null, placement ? Number(placement) : null);
  }
})();

const count = (t: string) => (db.prepare(`SELECT count(*) n FROM ${t}`).get() as { n: number }).n;
console.log(`Imported ${count('sessions')} sessions, ${count('plays')} plays, ${count('players')} players, ${count('games')} games.`);
