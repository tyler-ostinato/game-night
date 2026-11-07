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

## Where the legacy data came from

Games from before the site existed were copied from a handwritten notebook. They're in the database like everything else, flagged `legacy = 1`. The notebook mostly recorded only the winner, which is why the stats treat legacy games differently (see the [README](../README.md#how-the-stats-work)).

Cleanup applied when they were imported:
- Typos and swapped columns were fixed, and rows with a blank placement (the listed player was the winner) were set to 1st.
- Only games noted as the same night in the notebook were grouped into one game night.
- Game times are kept as the notebook wrote them (e.g. `2:40am`), not as timestamps.
- Three out-of-order dates were replaced with the midpoint between their neighbours. Each has `Date estimated (originally …)` in its notes.

The original CSV, the import script and the old SQLite database were retired in November 2026. The database is now the only copy of the data, and Neon's restore points are the backup (see [docs/development.md](development.md#deploying)). The scripts are still in git history if they're ever needed.
