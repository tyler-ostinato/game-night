// Database tables. Applied automatically on server start (see ensureSchema in db.ts) and by
// `npm run db:setup`. Changes must be additive only (see CLAUDE.md): this runs against production.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS games (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  image TEXT                -- cover image URL (Vercel Blob)
);

-- A session is one game night. date = the night it started (YYYY-MM-DD).
-- Live sessions have started_at/ended_at (ISO timestamps); legacy ones don't.
CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  date       TEXT NOT NULL,
  legacy     INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  ended_at   TEXT
);

-- One play of a game within a session.
CREATE TABLE IF NOT EXISTS plays (
  id         SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  game_id    INTEGER NOT NULL REFERENCES games(id),
  expansions TEXT,          -- pipe-separated original CSV text; play_expansions is the source of truth
  end_time   TEXT,
  notes      TEXT,
  legacy     INTEGER NOT NULL DEFAULT 0
);

-- Who took part in a play. Legacy plays often only have the winner.
CREATE TABLE IF NOT EXISTS play_players (
  play_id   INTEGER NOT NULL REFERENCES plays(id),
  player_id INTEGER NOT NULL REFERENCES players(id),
  score     INTEGER,
  placement INTEGER,
  PRIMARY KEY (play_id, player_id)
);

-- Login tokens handed out after the password check.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

-- Expansions belong to a base game; renaming one updates every play that used it.
CREATE TABLE IF NOT EXISTS expansions (
  id      SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  UNIQUE (game_id, name)
);

CREATE TABLE IF NOT EXISTS play_expansions (
  play_id      INTEGER NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  expansion_id INTEGER NOT NULL REFERENCES expansions(id),
  PRIMARY KEY (play_id, expansion_id)
);

-- Login tokens: stored hashed; password_tag ties each to the password it was issued under.
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS password_tag TEXT;

-- Wrong-password attempts, for brute-force protection shared by every server instance.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_at ON login_attempts (at);

-- Each player's 8-bit character (JSON, see client/src/sprite.ts). NULL = the default made from their name.
ALTER TABLE players ADD COLUMN IF NOT EXISTS look TEXT;

`;
