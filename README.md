# Game Night

Tracks our game nights: who played, who won, scores, records, and stats for each player and each game.

- **server/**: Express API (TypeScript) on top of Postgres (Neon); covers live in Vercel Blob
- **client/**: React + Vite site (TypeScript)
- **api/**: the entry point Vercel runs the server from
- **data/** (not in git): the old SQLite database and covers, and the CSV of past results

Hosted on Vercel. Every push to `main` deploys; other branches get a preview URL.

## Getting started

Requires Node 22+ and access to the Vercel project (ask Tyler to invite you). Run everything from the top `game-night` folder:

```bash
npm run setup          # install everything (first time only)
npx vercel login       # first time only
npx vercel link        # first time only: pick the game-night project
npx vercel env pull    # writes the settings (database etc.) to .env.local; never commit it
npm run dev            # starts the API (:3001) and the site (:5173) together
```

`npm run dev` uses the **real** database, the same one the live site uses. Use [testing mode](#testing-mode) to experiment.

Open http://localhost:5173. Both halves reload automatically when you edit code, and one Ctrl+C stops both.

| Command | What it does |
|---|---|
| `npm run dev` | Normal mode: real data, API on :3001, site on :5173 |
| `npm run dev:test` | Testing mode on a separate database (see [Testing mode](#testing-mode)) |
| `npm run db:setup` | Create the tables (add `-- --test` for the test database) |
| `npm run import` | Reload the legacy CSV (keeps game nights recorded on the site) |
| `npm run migrate-sqlite` | One-off: copy `data/gamenight.db` and `data/images/` into Postgres and Blob |
| `npm run setup` | Install dependencies for the root, server and client |

## The site

| Tab | What's on it |
|---|---|
| **Game night** | Start, end or cancel tonight's session, and add each game as it finishes |
| **Leaderboard** | Podium with gold/silver/bronze crowns for the top 3, everyone else ranked below |
| **Players** | A card per player; click one for their profile. **+ Add player** adds someone before their first game |
| **History** | Pick a time frame (last 30 days, 3 months, 12 months, all time, or custom dates) and group by days, weeks or months. The chart shows games played per period, stacked and coloured by game (hover a bar for its games; hover a legend entry to highlight one game). Below it, the game nights in that time frame, 10 at a time, more load as you scroll |
| **Records** | Highest score ever posted in each game |
| **Games** | A tile per game with its cover and champion; click one for its stats page |

**Player profile:** wins, win rate, game nights, best win streak, the game they've won most, best win rate, most played game, first win, nemesis (who they finish behind most) and favourite opponent, plus a per-game breakdown, head-to-head record against everyone, and their full history.

**Game page:** champion, high score, average winning score, game nights, different players, average table size, a "who wins" ranking, expansions used, and every time it was played. Press **Edit** to rename it, set its cover, or manage expansions.

**Legacy games switch** (top right of the header): turn it off to see only games recorded on the site. It applies to every tab and is remembered per device.

Clicking a player's name anywhere opens their profile. Viewing is public; changing anything needs the password (see [Password](#password)).

## Game night flow

1. Open **Game night** and log in.
2. Press **Start game night**. Only one session can be open at a time.
3. After each game, fill in **Add a game**:
   - **Game:** tap its tile (search if the list is long), or **+ New game**.
   - **Expansions:** tap the chips for any that were used, or **+ New expansion**.
   - **Everyone who played:** tap player chips to add them (tap again to remove), or type a new name. Give everyone a placement (1 = winner; ties share a number). Scores are optional.
   - **Notes:** optional.
   - The game's end time is recorded automatically when you press **Save game**.
4. Press **End game night** when you're done. A session left open ends itself 12 hours after it started.

**Cancel session** deletes the running session and any games logged in it. Use it if a session was started by accident. Past sessions can't be cancelled.

A session is dated by the night it **started**, so a game finishing at 1am still counts for that evening.

## Games and covers

- **Add a game:** the **+ Add game** button on the Games tab, or **+ New game** in the picker.
- **Edit a game:** open it and press **Edit** to rename it, change its cover, or add, rename and delete expansions. Renaming updates history everywhere.
- **Deleting:** a game or expansion can only be deleted if it has never been played, so history can't be lost. The server enforces this too.
- **Covers:**
  - In **Edit**, paste an image link or upload a photo. For an image link, right-click a box image on BoardGameGeek and choose *Copy image address*.
  - The server keeps its own copy in Vercel Blob, so covers keep working if the original link dies.
  - Uploads are shrunk in the browser first; the limit is 5 MB.
  - The current covers came from BoardGameGeek. **Cluedo** uses BGG's *Clue (1949)* entry and **Dune** uses *Dune: Imperium (2020)*.
- **BoardGameGeek search:** BGG's search API needs a free token (register at https://boardgamegeek.com/using_the_xml_api). Start the server with `BGG_TOKEN=...` to get a **Search BGG** box in the cover editor. This hasn't been tested with a real token yet.

## How the stats work

**Legacy data:** everything imported from `data/results.csv` is flagged `legacy`. It came from a handwritten notebook and mostly records only the winner. Everything entered on the site is non-legacy.

**Full games:** a game where more than one player was recorded.
- **Counted for all games:** wins and games played.
- **Counted only for full games:** win rate, win streaks and head-to-head. Otherwise someone with one recorded game (a win) would show 100%. The site marks these stats with \*.

**Head-to-head:** in a full game, finishing with a better placement counts as beating that player. Some legacy games list everyone but only mark the winner; there, the winner counts as beating everyone else at the table.

**Ranking:** most wins, then best win rate, then name. Tied players share a place: two 1st places, then 3rd. Crowns and podium spots need at least one win.

## Data

### Database tables (`server/src/schema.sql`)

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

### The legacy CSV (`data/results.csv`)

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

### Files in `data/`

| File | What it is |
|---|---|
| `gamenight.db` | The old SQLite database (before the move to Postgres) |
| `images/` | The old covers (now copied to Blob) |
| `results.csv` | Cleaned legacy results (the import source) |
| `results.original.csv` | The CSV before cleanup |
| `gamenight.backup-before-cleanup.db` | Backup from before stray test data was removed; safe to delete |

## Password

- **Viewing** is public.
- **Making changes** needs the password: logging in, starting, ending or cancelling sessions, adding games or players, and editing games, expansions or covers.
- **Where it's checked:** on the server only (`server/src/auth.ts`). Set it with `GAMENIGHT_PASSWORD`; the server won't start without it (except in test mode).
- **Logins** last 30 days per device.
- **Wrong guesses:** after 10, that IP is blocked for 15 minutes. On Vercel each server instance counts separately, so this only slows guessing down.

## Testing mode

Use this to try things without touching real data.

```bash
npm run dev:test    # test API on :3002, test site on http://localhost:5174
```

- **Separate database:** it uses `TEST_DATABASE_URL` instead of `DATABASE_URL`, so it can't touch real results. Set it up once:
  1. In the Neon console (Vercel → Storage → your database → Open in Neon), create a **branch** called `dev`. It starts as a copy of the real data.
  2. Add its connection string to `.env.local` as `TEST_DATABASE_URL=...`.
  3. To start over, use **Reset from parent** on that branch in Neon.
- **Covers** uploaded in test mode go to a separate `test-covers/` folder in Blob.
- **No password**, because the test API only accepts connections from this computer.
- **Banner:** the site shows a yellow **TEST MODE** banner.
- **Separate ports:** it runs alongside the normal site.

## Code map

| File | What's in it |
|---|---|
| `server/src/app.ts` | API routes: sessions, plays, games, expansions, records |
| `server/src/index.ts` | Local dev server (Vercel uses `api/index.ts`) |
| `server/src/stats.ts` | Player profiles, leaderboard, per-game stats, champions |
| `server/src/images.ts` | Cover upload and download to Blob; BoardGameGeek search |
| `server/src/auth.ts` | Password check, login tokens, rate limiting |
| `server/src/db.ts`, `schema.sql` | Database connection and tables |
| `server/src/import.ts` | CSV import |
| `server/src/setup-db.ts` | Creates the tables |
| `server/src/migrate-sqlite.ts` | One-off SQLite → Postgres copy |
| `client/src/App.tsx` | Layout, Game night, Leaderboard, History, Records |
| `client/src/Players.tsx` | Players tab and player profile |
| `client/src/Activity.tsx` | History's activity chart |
| `client/src/Games.tsx` | Games tab, game page, editor, game picker |
| `client/src/ui.tsx` | Shared bits: avatars, crowns, covers, empty states |
| `client/src/api.ts` | API calls, login token, legacy switch |
| `client/src/index.css` | All styling (light and dark) |

### API

Read endpoints accept `?legacy=0` to leave out legacy games. Endpoints marked 🔒 need a login.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/mode` | Test mode and BGG search on/off |
| POST | `/api/login` | Exchange the password for a token |
| GET | `/api/sessions/active` | The running session and its games |
| POST 🔒 | `/api/sessions` | Start a session |
| POST 🔒 | `/api/sessions/:id/end` | End the running session |
| DELETE 🔒 | `/api/sessions/:id` | Cancel the running session |
| GET | `/api/plays` | All games played, newest first |
| POST 🔒 | `/api/plays` | Add a game to the running session |
| GET | `/api/players`, `/api/players/:name` | Player list and profile |
| POST 🔒 | `/api/players` | Add a player |
| GET | `/api/records` | High score per game |
| GET | `/api/games`, `/api/games/:id/stats` | Game list and game page |
| POST/PATCH/DELETE 🔒 | `/api/games`, `/api/games/:id` | Add, rename, delete a game |
| POST/PATCH/DELETE 🔒 | `/api/games/:id/expansions`, `/api/expansions/:id` | Add, rename, delete an expansion |
| PUT/DELETE 🔒 | `/api/games/:id/image` | Set (`url`, `dataUrl` or `bggId`) or remove a cover |
| GET 🔒 | `/api/bgg/search?q=` | Search BoardGameGeek (needs `BGG_TOKEN`) |

## Settings

| Variable | Default | Purpose |
|---|---|---|
| `GAMENIGHT_PASSWORD` | required | Password for making changes |
| `DATABASE_URL` | required | Postgres connection (set by Vercel's Neon integration) |
| `TEST_DATABASE_URL` | unset | Postgres connection for testing mode |
| `BLOB_STORE_ID`, `VERCEL_OIDC_TOKEN` | set by Vercel | Access to the cover image store |
| `BGG_TOKEN` | unset | BoardGameGeek token; turns on "Search BGG" |
| `PORT` | `3001` | API port |
| `GAMENIGHT_TEST` | unset | `1` = test mode: no password, localhost only, banner (set by `dev:test`) |
| `API_PORT` (client) | `3001` | Which API port the site talks to |

## Deploying

- **Automatic:** push to `main` and Vercel deploys it. Other branches and pull requests get their own preview URL, which uses the same real database.
- **Settings** live in Vercel → Project → Settings → Environment Variables. Change them there, not in code.
- **Backups:** Neon keeps restore points (Neon console → Restore). Never run testing mode on the public server, since it has no password.
