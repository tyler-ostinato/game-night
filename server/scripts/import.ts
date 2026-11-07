// Import of data/results.csv. Re-running replaces legacy data only; live sessions are kept.
import '../src/env.js';
import { readFileSync } from 'node:fs';
import { sql, idFor, expansionIdFor, resetSequences } from '../src/db.js';

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

await sql.begin(async tx => {
  await tx`DELETE FROM play_expansions WHERE play_id IN (SELECT id FROM plays WHERE legacy = 1)`;
  await tx`DELETE FROM play_players WHERE play_id IN (SELECT id FROM plays WHERE legacy = 1)`;
  await tx`DELETE FROM plays WHERE legacy = 1`;
  await tx`DELETE FROM sessions WHERE legacy = 1`;
  const insPP = (playId: number, playerId: number, score: number | null, placement: number | null) => tx`
    INSERT INTO play_players (play_id, player_id, score, placement) VALUES (${playId}, ${playerId}, ${score}, ${placement})
    ON CONFLICT (play_id, player_id) DO UPDATE SET score = coalesce(excluded.score, play_players.score),
      placement = coalesce(excluded.placement, play_players.placement)`;

  for (const r of rows) {
    const legacy = get(r, 'legacy') === '1' ? 1 : 0;
    const playId = Number(get(r, 'game_id'));
    const sessionId = Number(get(r, 'session_id'));
    await tx`INSERT INTO sessions (id, date, legacy) VALUES (${sessionId}, ${isoDate(get(r, 'date')!)}, ${legacy}) ON CONFLICT DO NOTHING`;
    const gameId = await idFor('games', get(r, 'game')!, tx);
    await tx`INSERT INTO plays (id, session_id, game_id, expansions, end_time, notes, legacy)
      VALUES (${playId}, ${sessionId}, ${gameId}, ${get(r, 'expansion')}, ${get(r, 'time')}, ${get(r, 'notes')}, ${legacy})`;
    for (const name of (get(r, 'expansion') ?? '').split('|').filter(Boolean)) {
      await tx`INSERT INTO play_expansions (play_id, expansion_id) VALUES (${playId}, ${await expansionIdFor(gameId, name, tx)})`;
    }

    const winner = get(r, 'player');
    const score = get(r, 'score');
    const placement = get(r, 'placement');
    for (const name of (get(r, 'attendance') ?? '').split('|').filter(Boolean)) {
      if (name !== winner) await insPP(playId, await idFor('players', name, tx), null, null);
    }
    if (winner) await insPP(playId, await idFor('players', winner, tx), score ? Number(score) : null, placement ? Number(placement) : null);
  }
  await resetSequences(tx);
});

const count = async (t: string) => (await sql`SELECT count(*)::int AS n FROM ${sql(t)}`)[0].n;
console.log(`Imported ${await count('sessions')} sessions, ${await count('plays')} plays, ${await count('players')} players, ${await count('games')} games.`);
await sql.end();
