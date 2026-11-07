# Game Night

Tracks our game nights: who played, who won, scores, records, and stats for each player and each game.

- **server/**: Express API (TypeScript) on top of Postgres (Neon); covers live in Vercel Blob
- **client/**: React + Vite site (TypeScript)
- **api/**: the entry point Vercel runs the server from
- **data/** (not in git): the old SQLite database and covers, and the CSV of past results

Hosted on Vercel; see [Hosting and storage](#hosting-and-storage). Every push to `main` deploys.

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
| `just test-up` / `just test-down` | Start / stop testing mode in the background (see [Testing mode](#testing-mode)) |
| `npm run db:setup` | Create the tables (add `-- --test` for the test database) |
| `npm run import` | Reload the legacy CSV (keeps game nights recorded on the site) |
| `npm run migrate-sqlite` | One-off: copy `data/gamenight.db` and `data/images/` into Postgres and Blob |
| `npm run setup` | Install dependencies for the root, server and client, and turn on the pre-commit check |
| `npm run check` / `just check` | Typecheck, lint and unit tests (what the pre-commit hook and CI run) |
| `npm test` | Unit tests only |

## Hosting and storage

```
 Browser ──► Vercel ──┬── static site (client/dist)          built from client/ on every deploy
                      └── /api/* ──► one serverless function  api/index.ts → server/src/app.ts
                                         │
                                         ├──► Neon Postgres   all results, players, games, logins
                                         └──► Vercel Blob     game cover images (public URLs)
```

- **Vercel** hosts everything. `vercel.json` tells it to install all three packages, build the client into static files, and send every `/api/*` request to one function that runs the Express app. Nothing runs between requests, so the server keeps nothing in memory or on disk.
- **Neon Postgres** holds all the data (tables in `server/src/schema.sql`). Vercel created it from the project's **Storage** tab and adds `DATABASE_URL` to the settings automatically. Live site, preview deploys and `npm run dev` all use **this same database**.
- **Vercel Blob** holds the covers. It's a **public** store: anyone with an image's URL can view it (the URLs end in a long random suffix), but only the server can upload or delete. Each game's `image` column holds the full Blob URL, and the browser loads it straight from Blob.
- **Settings** live in Vercel → Project → **Settings → Environment Variables**, separately for Production, Preview and Development. `npx vercel env pull` copies the Development ones into `.env.local`, which the server reads at startup. Change settings there, not in code.

### Deploying

We push straight to `main`; there are no pull requests or approvals. That makes the checks below the safety net:

- **Pre-commit check:** every `git commit` first runs `npm run check` (typechecks for the server and client, lint, and unit tests; a few seconds). If it fails, the commit is stopped; fix the problem and commit again. It's turned on by `npm run setup` (it sets `git config core.hooksPath .githooks`). Skip it only in an emergency with `git commit --no-verify`.
- **GitHub Actions** (`.github/workflows/ci.yml`) runs the same check on every push. It doesn't block Vercel, so a red ❌ on GitHub means the live site may already have the problem: fix it straight away.
- **Unit tests** are small and only cover pure logic (stats rules, the past-night time rule): `*.test.ts` files next to the code, run with Vitest. No database is needed.
- **Writes are tested in [testing mode](#testing-mode)** before pushing.
- **Conventions** for commit messages, database changes and what to check before pushing are in `CLAUDE.md`. Claude Code follows them automatically, and they're worth a read for people too.


- **Push to `main`:** Vercel builds and deploys it to the live site within a minute.
- **Push another branch or open a pull request:** Vercel deploys it to its own preview URL. Previews use the **real** database, so don't try destructive things there; use [testing mode](#testing-mode).
- **Backups:** Neon keeps restore points (Neon console → **Restore**). The old SQLite database is still in `data/` on Tyler's machine as a frozen backup from before the move.

## The site

| Tab | What's on it |
|---|---|
| **Game night** | Start, end or cancel tonight's session, and add each game as it finishes. Or add a past game night that wasn't logged |
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

### Adding a past game night

For a night that wasn't logged live. On **Game night** (when no session is running), press **+ Add a past game night**:

1. Pick the **date** the night started. It defaults to yesterday.
2. Add each game **in the order it was played**, using the same form as a live game, and press **Add game to list**. Each game has an optional **Finished at** time; leave it blank if you don't remember, and it shows as "time unknown". A time before 6am counts as the early hours after that date.
3. Fix the order with ↑ ↓, or remove a game with ✕.
4. Press **Save game night** at the bottom. Nothing is saved until then; the unsaved list is kept on your device, so switching tabs or refreshing doesn't lose it (the button reads **Continue unsaved past game night**). **Discard** throws it away.

Past nights count in every stat just like live ones. They have no start or end time, and games without a time sort by the order they were entered.

## Games and covers

- **Add a game:** the **+ Add game** button on the Games tab, or **+ New game** in the picker.
- **Edit a game:** open it and press **Edit** to rename it, change its cover, or add, rename and delete expansions. Renaming updates history everywhere.
- **Deleting:** a game or expansion can only be deleted if it has never been played, so history can't be lost. The server enforces this too.
- **Covers:** see [Updating covers](#updating-covers) below.
- **BoardGameGeek search:** BGG's search API needs a free token (register at https://boardgamegeek.com/using_the_xml_api). Add it as `BGG_TOKEN` in the Vercel settings to get a **Search BGG** box in the cover editor. This hasn't been tested with a real token yet.

### Updating covers

You never upload to Blob by hand. The site does it for you:

1. On the live site, log in, open the game on the **Games** tab and press **Edit**.
2. Under **Cover image**, either:
   - **paste an image link** and press enter (on BoardGameGeek, right-click the box image → *Copy image address*), or
   - **upload a file** from your computer or phone.
3. Done. The new cover shows straight away.

What happens behind the scenes:
- The **server** downloads the image (or takes the upload), checks it's a JPG, PNG, WebP, GIF or AVIF under 5 MB, and saves its own copy to Blob as `covers/<game id>-<random>.<ext>`. Hot-linking isn't used, so covers keep working if the original link dies.
- The game's `image` column is set to the new Blob URL, and the **old cover is deleted** from Blob. **Remove** deletes it and clears the column.
- Uploads are shrunk in the browser first, which keeps them well under Vercel's 4.5 MB request limit.
- Covers changed in **testing mode** go to `test-covers/` and only change the test database.
- To see or clean up files, use Vercel → **Storage** → the Blob store → **Browser**. Deleting a file there doesn't clear the game's `image` column, so it shows a broken image until you set a new cover. Use the site's **Remove** button instead.

The current covers came from BoardGameGeek. **Clue** uses BGG's *Clue (1949)* entry and **Dune** uses *Dune: Imperium (2020)*.
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

Testing mode is a private copy of the site for trying things out: logging fake game nights, testing a code change that writes data, or checking a cover upload. It touches a separate test database, never the real one.

```bash
just test-up        # start in the background: test site on http://localhost:5174, test API on :3002
just test-down      # stop it
```

Or run `npm run dev:test` to keep it in the foreground in a terminal (Ctrl+C stops it).

| Command | What it does |
|---|---|
| `just test-up` | Starts the test API and site in the background and waits until they're ready. Does nothing if already running |
| `just test-down` | Stops both, including a copy started by hand with `npm run dev:test` |
| `just test-restart` | Stop, then start |
| `just test-status` | Says whether it's running |
| `just test-logs` | Follows the output (Ctrl+C stops following, not the servers) |
| `just` | Lists all commands |

`just` is a small command runner ([install](https://github.com/casey/just#installation), e.g. `brew install just` or `cargo install just`). The commands live in `justfile`; the background process's id and log are kept in `.test-mode/` (not in git). On macOS, `test-up` needs `setsid` (`brew install util-linux`), or use `npm run dev:test` instead.

**When to use it**

| You want to… | Use |
|---|---|
| Change how something looks, or work on read-only pages | `npm run dev` is fine (real data, but you're only reading it) |
| Start/end sessions, log plays, add or rename games, test a new write endpoint | `npm run dev:test` |
| Show someone a change before it's live | A branch push (preview URL). Remember previews use real data |

**Where it runs:** only on your own computer. It's never deployed. The test API only accepts connections from your machine, which is why it doesn't ask for the password. Never run it on a public server.

**Where the test data lives:** in whatever Postgres database `TEST_DATABASE_URL` points at. The server refuses to start testing mode without it, so it can't fall back to the real database. Each person sets one up once:

1. Open the database in Neon (Vercel → **Storage** → the database → **Open in Neon**).
2. Create a **branch** (for example `dev-yourname`). A branch is a full copy of the real data at that moment, and changes to it never affect the real data.
3. Copy the branch's connection string and add it in Vercel → **Settings → Environment Variables** as `TEST_DATABASE_URL`, ticked for **Development only**. Then run `npx vercel env pull`.
   - It goes in Vercel rather than straight into `.env.local` because `vercel env pull` **overwrites** `.env.local` and would wipe anything you added by hand. If you share one test branch, one variable is enough. If you each want your own, add it to your `.env.local` by hand and add it back after every pull.
4. Run `just test-up` (or `npm run dev:test`).

**Starting over:** in Neon, open your branch and choose **Reset from parent**. It becomes a fresh copy of today's real data.

**Prefer working offline?** Any Postgres works. For example, with Docker:

```bash
docker run -d --name gamenight-test -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16-alpine
# in .env.local: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres
npm run db:setup -- --test     # create the (empty) tables
```

**Other details**
- **Covers** uploaded in testing mode go to a separate `test-covers/` folder in the Blob store, so they never replace real covers.
- **Banner:** the site shows a yellow **TEST MODE** banner so you can't mistake it for the real thing.
- **Separate ports:** it runs alongside `npm run dev`.

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
