CREATE TABLE IF NOT EXISTS players (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS games (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- A session is one game night. date = the night it started (YYYY-MM-DD).
CREATE TABLE IF NOT EXISTS sessions (
  id     INTEGER PRIMARY KEY,
  date   TEXT NOT NULL,
  legacy INTEGER NOT NULL DEFAULT 0
);

-- One play of a game within a session.
CREATE TABLE IF NOT EXISTS plays (
  id         INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  game_id    INTEGER NOT NULL REFERENCES games(id),
  expansions TEXT,          -- pipe-separated, e.g. "Traders|Barbarians"
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
  id      INTEGER PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  UNIQUE (game_id, name)
);

CREATE TABLE IF NOT EXISTS play_expansions (
  play_id      INTEGER NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  expansion_id INTEGER NOT NULL REFERENCES expansions(id),
  PRIMARY KEY (play_id, expansion_id)
);
