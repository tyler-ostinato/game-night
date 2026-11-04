import express from 'express';
import cors from 'cors';
import { db, idFor } from './db.js';
import { login, requireAuth } from './auth.js';
import { bggEnabled, imageRoutes, removeImage } from './images.js';
import { gameChampions, gameStats, playerList, playerProfile } from './stats.js';

const app = express();
app.use(cors());
app.use('/api', imageRoutes); // before express.json so uploads get their own size limit
app.use(express.json());

const SESSION_HOURS = 12;

type LiveSession = { id: number; date: string; started_at: string; ended_at: string | null };

// The open game night, if any. Sessions left open past 12 hours are closed here.
function activeSession(): LiveSession | null {
  const cutoff = new Date(Date.now() - SESSION_HOURS * 3_600_000).toISOString();
  db.prepare(`UPDATE sessions SET ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', started_at, '+${SESSION_HOURS} hours')
    WHERE ended_at IS NULL AND started_at IS NOT NULL AND started_at <= ?`).run(cutoff);
  return (db.prepare('SELECT id, date, started_at, ended_at FROM sessions WHERE started_at IS NOT NULL AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get() as LiveSession | undefined) ?? null;
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const TEST_MODE = process.env.GAMENIGHT_TEST === '1';

app.get('/api/mode', (_req, res) => res.json({ test: TEST_MODE, bgg: bggEnabled() }));

app.post('/api/login', login);

app.get('/api/sessions/active', (_req, res) => {
  const s = activeSession();
  if (!s) return res.json(null);
  const plays = db.prepare(`
    SELECT pl.id, g.name AS game, pl.end_time,
      (SELECT group_concat(p.name, ', ') FROM play_players pp JOIN players p ON p.id = pp.player_id
        WHERE pp.play_id = pl.id AND pp.placement = 1) AS winners
    FROM plays pl JOIN games g ON g.id = pl.game_id WHERE pl.session_id = ? ORDER BY pl.id`).all(s.id);
  res.json({ ...s, expires_at: new Date(Date.parse(s.started_at) + SESSION_HOURS * 3_600_000).toISOString(), plays });
});

app.post('/api/sessions', requireAuth, (_req, res) => {
  const existing = activeSession();
  if (existing) return res.status(409).json({ error: `Session #${existing.id} is already running.` });
  const now = new Date();
  const id = Number(db.prepare('INSERT INTO sessions (date, started_at) VALUES (?, ?)')
    .run(localDate(now), now.toISOString()).lastInsertRowid);
  res.status(201).json({ id });
});

app.post('/api/sessions/:id/end', requireAuth, (req, res) => {
  const s = activeSession();
  if (!s || s.id !== Number(req.params.id)) return res.status(404).json({ error: 'That session is not running.' });
  db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(new Date().toISOString(), s.id);
  res.json({ ok: true });
});

// Cancel a session started by mistake: removes it and any games logged in it.
app.delete('/api/sessions/:id', requireAuth, (req, res) => {
  const s = activeSession();
  if (!s || s.id !== Number(req.params.id)) return res.status(404).json({ error: 'Only the running session can be cancelled.' });
  db.transaction(() => {
    const plays = 'SELECT id FROM plays WHERE session_id = ?';
    db.prepare(`DELETE FROM play_expansions WHERE play_id IN (${plays})`).run(s.id);
    db.prepare(`DELETE FROM play_players WHERE play_id IN (${plays})`).run(s.id);
    db.prepare('DELETE FROM plays WHERE session_id = ?').run(s.id);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
  })();
  res.json({ ok: true });
});

const winsQuery = `
  SELECT p.name, count(*) AS wins
  FROM play_players pp JOIN players p ON p.id = pp.player_id
  WHERE pp.placement = 1
  GROUP BY p.id ORDER BY wins DESC, p.name`;

app.get('/api/leaderboard', (_req, res) => {
  res.json(db.prepare(winsQuery).all());
});

// ?legacy=0 hides the notebook-era (legacy) games from stats and history.
const withLegacy = (req: express.Request) => req.query.legacy !== '0';

app.get('/api/plays', (req, res) => {
  res.json(db.prepare(`
    SELECT pl.id, s.id AS session_id, s.date, pl.end_time, g.name AS game, pl.notes,
      (SELECT group_concat(e.name, ', ') FROM play_expansions pe JOIN expansions e ON e.id = pe.expansion_id
        WHERE pe.play_id = pl.id) AS expansions, pl.legacy,
      (SELECT group_concat(p.name, ', ') FROM play_players pp JOIN players p ON p.id = pp.player_id
        WHERE pp.play_id = pl.id AND pp.placement = 1) AS winners,
      (SELECT max(score) FROM play_players WHERE play_id = pl.id) AS top_score
    FROM plays pl JOIN sessions s ON s.id = pl.session_id JOIN games g ON g.id = pl.game_id
    WHERE ? OR pl.legacy = 0
    ORDER BY s.date DESC, pl.id DESC`).all(withLegacy(req) ? 1 : 0));
});

app.get('/api/players', (req, res) => res.json(playerList(withLegacy(req))));

app.post('/api/players', requireAuth, (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Player needs a name.' });
  if (db.prepare('SELECT 1 FROM players WHERE name = ? COLLATE NOCASE').get(name)) {
    return res.status(409).json({ error: `${name} is already a player.` });
  }
  res.status(201).json({ id: Number(db.prepare('INSERT INTO players (name) VALUES (?)').run(name).lastInsertRowid) });
});

app.get('/api/players/:name', (req, res) => {
  const profile = playerProfile(req.params.name, withLegacy(req));
  if (!profile) return res.status(404).json({ error: 'Not found' });
  res.json(profile);
});

app.get('/api/records', (req, res) => {
  res.json(db.prepare(`
    SELECT g.name AS game, p.name AS player, pp.score, s.date
    FROM play_players pp
    JOIN plays pl ON pl.id = pp.play_id JOIN games g ON g.id = pl.game_id
    JOIN sessions s ON s.id = pl.session_id JOIN players p ON p.id = pp.player_id
    WHERE (:all OR pl.legacy = 0) AND pp.score = (SELECT max(pp2.score) FROM play_players pp2 JOIN plays pl2 ON pl2.id = pp2.play_id
      WHERE pl2.game_id = pl.game_id AND (:all OR pl2.legacy = 0))
    ORDER BY g.name`).all({ all: withLegacy(req) ? 1 : 0 }));
});

app.get('/api/options', (_req, res) => {
  res.json({
    players: db.prepare('SELECT name FROM players ORDER BY name').pluck().all(),
  });
});

type GameRow = { id: number; name: string; image: string | null; plays: number; totalPlays: number };
type ExpansionRow = { id: number; game_id: number; name: string; plays: number };

app.get('/api/games', (req, res) => {
  // plays follows the legacy filter; totalPlays (all time) decides whether deleting is allowed.
  const games = db.prepare(`SELECT g.id, g.name, g.image,
      (SELECT count(*) FROM plays WHERE game_id = g.id AND (? OR legacy = 0)) AS plays,
      (SELECT count(*) FROM plays WHERE game_id = g.id) AS totalPlays
    FROM games g ORDER BY g.name COLLATE NOCASE`).all(withLegacy(req) ? 1 : 0) as GameRow[];
  const exps = db.prepare(`SELECT e.id, e.game_id, e.name, (SELECT count(*) FROM play_expansions WHERE expansion_id = e.id) AS plays
    FROM expansions e ORDER BY e.name COLLATE NOCASE`).all() as ExpansionRow[];
  const champs = gameChampions(withLegacy(req));
  res.json(games.map(g => ({
    ...g, podium: champs.get(g.id) ?? [],
    expansions: exps.filter(e => e.game_id === g.id).map(({ game_id, ...e }) => e),
  })));
});

app.get('/api/games/:id/stats', (req, res) => {
  const game = db.prepare('SELECT id, name, image FROM games WHERE id = ?').get(Number(req.params.id));
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  res.json({ ...game, ...gameStats(Number(req.params.id), withLegacy(req)) });
});

const cleanName = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isUnique = (err: unknown) => (err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE';

app.post('/api/games', requireAuth, (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Game needs a name.' });
  try {
    res.status(201).json({ id: Number(db.prepare('INSERT INTO games (name) VALUES (?)').run(name).lastInsertRowid) });
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: `${name} already exists.` });
    throw err;
  }
});

app.patch('/api/games/:id', requireAuth, (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Game needs a name.' });
  try {
    const { changes } = db.prepare('UPDATE games SET name = ? WHERE id = ?').run(name, Number(req.params.id));
    if (!changes) return res.status(404).json({ error: 'Game not found.' });
    res.json({ ok: true });
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: `${name} already exists.` });
    throw err;
  }
});

// Only games nobody has played can be deleted, so history is never lost.
app.delete('/api/games/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (db.prepare('SELECT 1 FROM plays WHERE game_id = ?').get(id)) {
    return res.status(409).json({ error: 'This game has been played, so it can\'t be deleted.' });
  }
  removeImage(id);
  db.prepare('DELETE FROM games WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.post('/api/games/:id/expansions', requireAuth, (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Expansion needs a name.' });
  try {
    res.status(201).json({ id: Number(db.prepare('INSERT INTO expansions (game_id, name) VALUES (?, ?)')
      .run(Number(req.params.id), name).lastInsertRowid) });
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: `${name} already exists for this game.` });
    if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(404).json({ error: 'Game not found.' });
    throw err;
  }
});

app.patch('/api/expansions/:id', requireAuth, (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Expansion needs a name.' });
  try {
    const { changes } = db.prepare('UPDATE expansions SET name = ? WHERE id = ?').run(name, Number(req.params.id));
    if (!changes) return res.status(404).json({ error: 'Expansion not found.' });
    res.json({ ok: true });
  } catch (err) {
    if (isUnique(err)) return res.status(409).json({ error: `${name} already exists for this game.` });
    throw err;
  }
});

app.delete('/api/expansions/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (db.prepare('SELECT 1 FROM play_expansions WHERE expansion_id = ?').get(id)) {
    return res.status(409).json({ error: 'This expansion has been played, so it can\'t be deleted.' });
  }
  db.prepare('DELETE FROM expansions WHERE id = ?').run(id);
  res.json({ ok: true });
});

// New (non-legacy) play, added to the running session. Requires every participant and a placement for each.
app.post('/api/plays', requireAuth, (req, res) => {
  const { gameId, expansionIds = [], notes, players } = req.body as {
    gameId: number; expansionIds?: number[]; notes?: string;
    players: { name: string; score?: number | null; placement: number }[];
  };
  const session = activeSession();
  if (!session) return res.status(409).json({ error: 'Start a game night session first.' });
  if (!db.prepare('SELECT 1 FROM games WHERE id = ?').get(gameId)) return res.status(400).json({ error: 'Pick a game.' });
  const validExp = db.prepare('SELECT 1 FROM expansions WHERE id = ? AND game_id = ?');
  if (expansionIds.some(e => !validExp.get(e, gameId))) return res.status(400).json({ error: 'Expansion doesn\'t belong to that game.' });
  if (!players?.length || players.some(p => !p.name?.trim() || !(p.placement >= 1))) {
    return res.status(400).json({ error: 'Need a name + placement for every player.' });
  }
  const id = db.transaction(() => {
    const playId = Number(db.prepare('INSERT INTO plays (session_id, game_id, end_time, notes) VALUES (?, ?, ?, ?)')
      .run(session.id, gameId, new Date().toISOString(), notes || null).lastInsertRowid); // end time = when it was saved
    const insExp = db.prepare('INSERT INTO play_expansions (play_id, expansion_id) VALUES (?, ?)');
    for (const e of new Set(expansionIds)) insExp.run(playId, e);
    const ins = db.prepare('INSERT INTO play_players (play_id, player_id, score, placement) VALUES (?, ?, ?, ?)');
    for (const p of players) ins.run(playId, idFor('players', p.name.trim()), p.score ?? null, p.placement);
    return playId;
  })();
  res.status(201).json({ id });
});

const PORT = Number(process.env.PORT ?? 3001);
// Always answer with JSON so the site can show a readable message.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: `Server error: ${err.message}` });
});

app.listen(PORT, TEST_MODE ? '127.0.0.1' : '0.0.0.0', () => console.log(`API on http://localhost:${PORT}${TEST_MODE ? ' (TEST MODE - using data/test.db, no password)' : ''}`));
