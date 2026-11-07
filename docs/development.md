# Development

Everything for working on the code. For using the site, see the [README](../README.md).

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
| `npm run setup` | Install dependencies for the root, server and client, and turn on the pre-commit check |
| `npm run check` / `just check` | Typecheck, lint and unit tests (what the pre-commit hook and CI run) |
| `npm test` | Unit tests only |

## Folders

| Folder | What's in it |
|---|---|
| `client/` | The website: React + Vite (TypeScript) |
| `server/src/` | The API: Express on Postgres (TypeScript) |
| `server/scripts/` | Command-line tools: create the tables |
| `api/` | The file Vercel runs the API from, and the [API route list](../api/README.md) |
| `docs/` | These docs |
| `.githooks/`, `.github/` | Pre-commit check and GitHub Actions |

## Hosting and storage

```
 Browser ──► Vercel ──┬── static site (client/dist)          built from client/ on every deploy
                      └── /api/* ──► one serverless function  api/index.ts → server/src/app.ts
                                         │
                                         ├──► Neon Postgres   all results, players, games, logins
                                         └──► Vercel Blob     game cover images (public URLs)
```

- **Vercel** hosts everything. `vercel.json` tells it to install all three packages, build the client into static files, and send every `/api/*` request to one function that runs the Express app. Nothing runs between requests, so the server keeps nothing in memory or on disk.
- **Neon Postgres** holds all the data (tables in `server/src/schema.ts`). Vercel created it from the project's **Storage** tab and adds `DATABASE_URL` to the settings automatically. Live site, preview deploys and `npm run dev` all use **this same database**.
- **Vercel Blob** holds the covers. It's a **public** store: anyone with an image's URL can view it (the URLs end in a long random suffix), but only the server can upload or delete. Each game's `image` column holds the full Blob URL, and the browser loads it straight from Blob.
- **Settings** live in Vercel → Project → **Settings → Environment Variables**, separately for Production, Preview and Development. `npx vercel env pull` copies the Development ones into `.env.local`, which the server reads at startup. Change settings there, not in code.

### Deploying

We push straight to `main`; there are no pull requests or approvals. That makes the checks below the safety net:

- **Pre-commit check:** every `git commit` first runs `npm run check` (typechecks for the server and client, lint, and unit tests; a few seconds). If it fails, the commit is stopped; fix the problem and commit again. It's turned on by `npm run setup` (it sets `git config core.hooksPath .githooks`). Skip it only in an emergency with `git commit --no-verify`.
- **GitHub Actions** (`.github/workflows/ci.yml`) runs the same check on every push. It doesn't block Vercel, so a red ❌ on GitHub means the live site may already have the problem: fix it straight away.
- **Unit tests** are small and only cover pure logic (stats rules, the past-night time rule): `*.test.ts` files next to the code, run with Vitest. No database is needed.
- **Writes are tested in [testing mode](#testing-mode)** before pushing.
- **Conventions** for commit messages, database changes and what to check before pushing are in [`CLAUDE.md`](../CLAUDE.md). Claude Code follows them automatically, and they're worth a read for people too.
- **Push to `main`:** Vercel builds and deploys it to the live site within a minute.
- **Push another branch or open a pull request:** Vercel deploys it to its own preview URL. Previews use the **real** database, so don't try destructive things there; use [testing mode](#testing-mode).
- **Backups:** Neon keeps restore points (Neon console → **Restore**). The database is the only copy of the data, so these are the backup.


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


## Password

- **Viewing** is public.
- **Making changes** needs the password: logging in, starting, ending or cancelling sessions, adding games or players, and editing games, expansions or covers.
- **Where it's checked:** on the server only (`server/src/auth.ts`). Set it with `GAMENIGHT_PASSWORD`; the server won't start without it (except in test mode).
- **Logins** last 30 days per device. **Log out** (top right) ends the login on that device.
- **Changing the password logs everyone out.** Each login remembers which password it came from, so if the password may have leaked, change `GAMENIGHT_PASSWORD` in Vercel and redeploy.
- **Wrong guesses:** after 10 from one address, that address is blocked for 15 minutes; after 100 from everyone combined, logging in pauses for 15 minutes. The counts live in the database (`login_attempts`), so all Vercel instances share them. The address comes from Vercel's `x-real-ip` header, which browsers can't fake.
- **Logins are stored hashed** (SHA-256), so a copy of the database doesn't contain usable logins. Expired ones are deleted whenever someone logs in.
- **Testing mode can't run on Vercel.** It turns the password off, so the server refuses to start if `GAMENIGHT_TEST` is set there.

### Other protections

- **Database queries** always pass values separately from the SQL (the `postgres` library's tagged templates), so nothing typed into the site can change a query. Never build SQL by joining strings.
- **Error messages** on the live site are generic; details go to the Vercel logs. Locally you see the full message.
- **Cover links** can only point at public websites: links (and every redirect) to this computer, private networks or cloud metadata addresses are refused.
- **Covers in testing mode** only ever delete files in `test-covers/`, never the real covers the test database's games still point at.


## Code map

| File | What's in it |
|---|---|
| `server/src/app.ts` | API routes: sessions, plays, games, expansions, records |
| `server/src/index.ts` | Local dev server (Vercel uses `api/index.ts`) |
| `server/src/stats.ts` | Player profiles, leaderboard, per-game stats, champions |
| `server/src/images.ts` | Cover upload and download to Blob; BoardGameGeek search |
| `server/src/auth.ts` | Password check, login tokens, rate limiting |
| `server/src/db.ts`, `schema.ts` | Database connection and tables |
| `server/scripts/setup-db.ts` | Creates the tables (`npm run db:setup`) |
| `client/src/App.tsx` | Layout, Game night, Leaderboard, History, Records |
| `client/src/Players.tsx` | Players tab and player profile |
| `client/src/Activity.tsx` | History's activity chart |
| `client/src/Games.tsx` | Games tab, game page, editor, game picker |
| `client/src/ui.tsx` | Shared bits: avatars, crowns, covers, empty states |
| `client/src/time.ts` | Date helpers for past game nights |
| `client/src/api.ts` | API calls, login token, legacy switch |
| `client/src/index.css` | All styling (light and dark) |
| `*.test.ts` | Unit tests, next to the code they cover |

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
