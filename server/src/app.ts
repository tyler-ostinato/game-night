import express from 'express';
import cors from 'cors';
import { sql, idFor, ensureSchema, TEST_MODE } from './db.js';
import { login, logout, requireAuth } from './auth.js';
import { bggEnabled, imageRoutes, removeImage } from './images.js';
import { gameChampions, gameStats, playerList, playerProfile } from './stats.js';

const app = express();
app.use(cors());
app.use(async (_req, _res, next) => { try { await ensureSchema(); next(); } catch (err) { next(err); } });
app.use('/api', imageRoutes); // before express.json so uploads get their own size limit
app.use(express.json());

const SESSION_HOURS = 12;

type LiveSession = { id: number; date: string; started_at: string; ended_at: string | null };

// The open game night, if any. Sessions left open past 12 hours are closed here.
async function activeSession(): Promise<LiveSession | null> {
  const cutoff = new Date(Date.now() - SESSION_HOURS * 3_600_000).toISOString();
  await sql`UPDATE sessions
    SET ended_at = to_char((started_at::timestamptz + make_interval(hours => ${SESSION_HOURS})) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    WHERE ended_at IS NULL AND started_at IS NOT NULL AND started_at <= ${cutoff}`;
  const [s] = await sql<LiveSession[]>`SELECT id, date, started_at, ended_at FROM sessions
    WHERE started_at IS NOT NULL AND ended_at IS NULL ORDER BY id DESC LIMIT 1`;
  return s ?? null;
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export { TEST_MODE };

app.get('/api/mode', (_req, res) => res.json({ test: TEST_MODE, bgg: bggEnabled() }));

app.post('/api/login', login);
app.post('/api/logout', logout);

app.get('/api/sessions/active', async (_req, res) => {
  const s = await activeSession();
  if (!s) return res.json(null);
  const plays = await sql`
    SELECT pl.id, g.name AS game, pl.end_time,
      (SELECT string_agg(p.name, ', ') FROM play_players pp JOIN players p ON p.id = pp.player_id
        WHERE pp.play_id = pl.id AND pp.placement = 1) AS winners
    FROM plays pl JOIN games g ON g.id = pl.game_id WHERE pl.session_id = ${s.id} ORDER BY pl.id`;
  res.json({ ...s, expires_at: new Date(Date.parse(s.started_at) + SESSION_HOURS * 3_600_000).toISOString(), plays });
});

app.post('/api/sessions', requireAuth, async (_req, res) => {
  const existing = await activeSession();
  if (existing) return res.status(409).json({ error: `Session #${existing.id} is already running.` });
  const now = new Date();
  const [{ id }] = await sql`INSERT INTO sessions (date, started_at) VALUES (${localDate(now)}, ${now.toISOString()}) RETURNING id`;
  res.status(201).json({ id });
});

app.post('/api/sessions/:id/end', requireAuth, async (req, res) => {
  const s = await activeSession();
  if (!s || s.id !== Number(req.params.id)) return res.status(404).json({ error: 'That session is not running.' });
  await sql`UPDATE sessions SET ended_at = ${new Date().toISOString()} WHERE id = ${s.id}`;
  res.json({ ok: true });
});

// Cancel a session started by mistake: removes it and any games logged in it.
app.delete('/api/sessions/:id', requireAuth, async (req, res) => {
  const s = await activeSession();
  if (!s || s.id !== Number(req.params.id)) return res.status(404).json({ error: 'Only the running session can be cancelled.' });
  await sql.begin(async tx => {
    const plays = tx`SELECT id FROM plays WHERE session_id = ${s.id}`;
    await tx`DELETE FROM play_expansions WHERE play_id IN (${plays})`;
    await tx`DELETE FROM play_players WHERE play_id IN (${plays})`;
    await tx`DELETE FROM plays WHERE session_id = ${s.id}`;
    await tx`DELETE FROM sessions WHERE id = ${s.id}`;
  });
  res.json({ ok: true });
});

app.get('/api/leaderboard', async (_req, res) => {
  res.json(await sql`
    SELECT p.name, count(*)::int AS wins
    FROM play_players pp JOIN players p ON p.id = pp.player_id
    WHERE pp.placement = 1
    GROUP BY p.id ORDER BY wins DESC, p.name`);
});

// ?legacy=0 hides the notebook-era (legacy) games from stats and history.
const withLegacy = (req: express.Request) => req.query.legacy !== '0';

app.get('/api/plays', async (req, res) => {
  res.json(await sql`
    SELECT pl.id, s.id AS session_id, s.date, pl.end_time, g.name AS game, pl.notes,
      (SELECT string_agg(e.name, ', ') FROM play_expansions pe JOIN expansions e ON e.id = pe.expansion_id
        WHERE pe.play_id = pl.id) AS expansions, pl.legacy,
      (SELECT string_agg(p.name, ', ') FROM play_players pp JOIN players p ON p.id = pp.player_id
        WHERE pp.play_id = pl.id AND pp.placement = 1) AS winners,
      (SELECT max(score) FROM play_players WHERE play_id = pl.id) AS top_score
    FROM plays pl JOIN sessions s ON s.id = pl.session_id JOIN games g ON g.id = pl.game_id
    WHERE ${withLegacy(req)} OR pl.legacy = 0
    ORDER BY s.date DESC, pl.id DESC`);
});

app.get('/api/players', async (req, res) => res.json(await playerList(withLegacy(req))));

app.post('/api/players', requireAuth, async (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Player needs a name.' });
  if ((await sql`SELECT 1 FROM players WHERE lower(name) = lower(${name})`).length) {
    return res.status(409).json({ error: `${name} is already a player.` });
  }
  const [{ id }] = await sql`INSERT INTO players (name) VALUES (${name}) RETURNING id`;
  res.status(201).json({ id });
});

app.get('/api/players/:name', async (req, res) => {
  const profile = await playerProfile(req.params.name, withLegacy(req));
  if (!profile) return res.status(404).json({ error: 'Not found' });
  res.json(profile);
});

app.get('/api/records', async (req, res) => {
  const all = withLegacy(req);
  res.json(await sql`
    SELECT g.name AS game, p.name AS player, pp.score, s.date
    FROM play_players pp
    JOIN plays pl ON pl.id = pp.play_id JOIN games g ON g.id = pl.game_id
    JOIN sessions s ON s.id = pl.session_id JOIN players p ON p.id = pp.player_id
    WHERE (${all} OR pl.legacy = 0) AND pp.score = (SELECT max(pp2.score) FROM play_players pp2 JOIN plays pl2 ON pl2.id = pp2.play_id
      WHERE pl2.game_id = pl.game_id AND (${all} OR pl2.legacy = 0))
    ORDER BY g.name`);
});

app.get('/api/options', async (_req, res) => {
  res.json({ players: (await sql`SELECT name FROM players ORDER BY name`).map(r => r.name) });
});

type GameRow = { id: number; name: string; image: string | null; plays: number; totalPlays: number };
type ExpansionRow = { id: number; game_id: number; name: string; plays: number };

app.get('/api/games', async (req, res) => {
  // plays follows the legacy filter; totalPlays (all time) decides whether deleting is allowed.
  const games = await sql<GameRow[]>`SELECT g.id, g.name, g.image,
      (SELECT count(*)::int FROM plays WHERE game_id = g.id AND (${withLegacy(req)} OR legacy = 0)) AS plays,
      (SELECT count(*)::int FROM plays WHERE game_id = g.id) AS "totalPlays"
    FROM games g ORDER BY lower(g.name)`;
  const exps = await sql<ExpansionRow[]>`SELECT e.id, e.game_id, e.name,
      (SELECT count(*)::int FROM play_expansions WHERE expansion_id = e.id) AS plays
    FROM expansions e ORDER BY lower(e.name)`;
  const champs = await gameChampions(withLegacy(req));
  res.json(games.map(g => ({
    ...g, podium: champs.get(g.id) ?? [],
    expansions: exps.filter(e => e.game_id === g.id).map(({ game_id, ...e }) => e),
  })));
});

app.get('/api/games/:id/stats', async (req, res) => {
  const [game] = await sql`SELECT id, name, image FROM games WHERE id = ${Number(req.params.id)}`;
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  res.json({ ...game, ...(await gameStats(Number(req.params.id), withLegacy(req))) });
});

const cleanName = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const pgCode = (err: unknown) => (err as { code?: string }).code;
const isUnique = (err: unknown) => pgCode(err) === '23505';

app.post('/api/games', requireAuth, async (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Game needs a name.' });
  try {
    const [{ id }] = await sql`INSERT INTO games (name) VALUES (${name}) RETURNING id`;
    res.status(201).json({ id });
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: `${name} already exists.` });
    throw err;
  }
});

app.patch('/api/games/:id', requireAuth, async (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Game needs a name.' });
  try {
    const { count } = await sql`UPDATE games SET name = ${name} WHERE id = ${Number(req.params.id)}`;
    if (!count) return res.status(404).json({ error: 'Game not found.' });
    res.json({ ok: true });
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: `${name} already exists.` });
    throw err;
  }
});

// Only games nobody has played can be deleted, so history is never lost.
app.delete('/api/games/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if ((await sql`SELECT 1 FROM plays WHERE game_id = ${id}`).length) {
    return res.status(409).json({ error: 'This game has been played, so it can\'t be deleted.' });
  }
  await removeImage(id);
  await sql`DELETE FROM games WHERE id = ${id}`;
  res.json({ ok: true });
});

app.post('/api/games/:id/expansions', requireAuth, async (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Expansion needs a name.' });
  try {
    const [{ id }] = await sql`INSERT INTO expansions (game_id, name) VALUES (${Number(req.params.id)}, ${name}) RETURNING id`;
    res.status(201).json({ id });
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: `${name} already exists for this game.` });
    if (pgCode(err) === '23503') return res.status(404).json({ error: 'Game not found.' });
    throw err;
  }
});

app.patch('/api/expansions/:id', requireAuth, async (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Expansion needs a name.' });
  try {
    const { count } = await sql`UPDATE expansions SET name = ${name} WHERE id = ${Number(req.params.id)}`;
    if (!count) return res.status(404).json({ error: 'Expansion not found.' });
    res.json({ ok: true });
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: `${name} already exists for this game.` });
    throw err;
  }
});

app.delete('/api/expansions/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if ((await sql`SELECT 1 FROM play_expansions WHERE expansion_id = ${id}`).length) {
    return res.status(409).json({ error: 'This expansion has been played, so it can\'t be deleted.' });
  }
  await sql`DELETE FROM expansions WHERE id = ${id}`;
  res.json({ ok: true });
});

// New (non-legacy) play, added to the running session. Requires every participant and a placement for each.
app.post('/api/plays', requireAuth, async (req, res) => {
  const play = req.body as NewPlay;
  const session = await activeSession();
  if (!session) return res.status(409).json({ error: 'Start a game night session first.' });
  const err = await playError(play);
  if (err) return res.status(400).json({ error: err });
  // end time = when it was saved
  const id = await sql.begin(tx => insertPlay(tx as unknown as typeof sql, session.id, play, new Date().toISOString()));
  res.status(201).json({ id });
});

type NewPlay = {
  gameId: number; expansionIds?: number[]; notes?: string; endTime?: string | null;
  players: { name: string; score?: number | null; placement: number }[];
};

// Checks one play's game, expansions and players. Returns an error message, or null if it's fine.
async function playError(p: NewPlay): Promise<string | null> {
  if (!(await sql`SELECT 1 FROM games WHERE id = ${p.gameId}`).length) return 'Pick a game.';
  const valid = await sql`SELECT id FROM expansions WHERE game_id = ${p.gameId}`;
  if ((p.expansionIds ?? []).some(e => !valid.some(v => v.id === e))) return 'Expansion doesn\'t belong to that game.';
  if (!p.players?.length || p.players.some(x => !x.name?.trim() || !(x.placement >= 1))) return 'Need a name + placement for every player.';
  return null;
}

async function insertPlay(tx: typeof sql, sessionId: number, p: NewPlay, endTime: string | null) {
  const [{ id: playId }] = await tx`INSERT INTO plays (session_id, game_id, end_time, notes)
    VALUES (${sessionId}, ${p.gameId}, ${endTime}, ${p.notes || null}) RETURNING id`;
  for (const e of new Set(p.expansionIds ?? [])) await tx`INSERT INTO play_expansions (play_id, expansion_id) VALUES (${playId}, ${e})`;
  for (const x of p.players) {
    await tx`INSERT INTO play_players (play_id, player_id, score, placement)
      VALUES (${playId}, ${await idFor('players', x.name.trim(), tx)}, ${x.score ?? null}, ${x.placement})`;
  }
  return playId as number;
}

// A missed game night entered afterwards. Date is required; start/end times are unknown so stay empty.
// Plays are saved in the order given (that's their order on the night); each end time is optional.
app.post('/api/sessions/past', requireAuth, async (req, res) => {
  const { date, plays } = req.body as { date: string; plays: NewPlay[] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || isNaN(Date.parse(date))) return res.status(400).json({ error: 'Pick a date.' });
  if (date > localDate(new Date())) return res.status(400).json({ error: 'That date is in the future.' });
  if (!plays?.length) return res.status(400).json({ error: 'Add at least one game.' });
  for (const [i, p] of plays.entries()) {
    const err = await playError(p);
    if (err) return res.status(400).json({ error: `Game ${i + 1}: ${err}` });
    if (p.endTime && isNaN(Date.parse(p.endTime))) return res.status(400).json({ error: `Game ${i + 1}: bad time.` });
  }
  const id = await sql.begin(async tx => {
    const [{ id: sessionId }] = await tx`INSERT INTO sessions (date) VALUES (${date}) RETURNING id`;
    for (const p of plays) await insertPlay(tx as unknown as typeof sql, sessionId, p, p.endTime ? new Date(p.endTime).toISOString() : null);
    return sessionId as number;
  });
  res.status(201).json({ id });
});

// Always answer with JSON so the site can show a readable message.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  // Details only on your own computer; the live site gets a generic message so it doesn't reveal internals.
  res.status(500).json({ error: process.env.VERCEL ? 'Something went wrong on the server. Please try again.' : `Server error: ${err.message}` });
});

export default app;
