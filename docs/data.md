# Data

What's stored where. For the stats rules, see the [README](../README.md#how-the-stats-work).

## Database tables (`server/src/schema.sql`)

| Table | What it holds |
|---|---|
| `sessions` | One game night: `date` (night it started), `started_at`, `ended_at`, `legacy` |
| `plays` | One game played during a session, with notes and end time |
| `play_players` | Who was in a play, with score and placement |
| `games` | Game names and cover image URL |
| `expansions` | Expansions, each belonging to one game |
| `play_expansions` | Which expansions were used in a play |
| `players` | Player names |
| `auth_tokens` | Logins handed out after the password check |

The tables are created, and new columns added, automatically when the server starts (`server/src/schema.sql`, `server/src/db.ts`).

## The legacy CSV (`data/results.csv`)

One row per game played, with these columns:

| Column | Notes |
|---|---|
| `session_id` | The game night. Games on the same night share it. Only games noted as the same night in the notebook were grouped. |
| `game_id` | One play of a game |
| `date` | `MM/DD/YY`, the night the session started |
| `time` | When the game ended, as written in the notebook (e.g. `2:40am`) |
| `game` | Base game name (e.g. `Catan`) |
| `expansion` | Expansions used, separated by `\|` (e.g. `Traders\|Barbarians`) |
| `player` | The winner |
| `score`, `placement` | The winner's score and placement, if known |
| `notes` | Separated by `\|` |
| `attendance` | Everyone who played, separated by `\|`, when known |
| `legacy` | Always `1` |

Cleanup already applied to the notebook data:
- Typos and swapped columns fixed, and rows with a blank placement (the listed player was the winner) set to 1st.
- Three out-of-order dates were replaced with the midpoint between their neighbours. Each has `Date estimated (originally …)` in its notes.
- The untouched original is kept as `data/results.original.csv`.

## Files in `data/`

| File | What it is |
|---|---|
| `gamenight.db` | The old SQLite database (before the move to Postgres) |
| `images/` | The old covers (now copied to Blob) |
| `results.csv` | Cleaned legacy results (the import source) |
| `results.original.csv` | The CSV before cleanup |
| `gamenight.backup-before-cleanup.db` | Backup from before stray test data was removed; safe to delete |

