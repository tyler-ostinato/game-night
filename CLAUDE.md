# CLAUDE.md

Game Night tracker: Express API (`server/`) + React/Vite site (`client/`) on Vercel, Postgres on Neon, covers in Vercel Blob.

Docs are the source of truth; read the relevant one before changing behaviour, and update it in the same commit:
- `README.md`: what the site does and how to use it (features, flows, stats rules)
- `docs/development.md`: setup, commands, testing mode, hosting, deploying, settings, code map
- `docs/data.md`: tables, where the legacy data came from
- `api/README.md`: every API route (add new routes here)

## First session on a new machine

At the start of a session, check the developer is set up, and help them finish if not:
- `git config core.hooksPath` should print `.githooks`. If not (or `node_modules` is missing), run `npm run setup`, which installs everything and turns on the pre-commit check.
- `.env.local` should exist. If not, they need access to the Vercel project (ask Tyler), then `npx vercel login`, `npx vercel link`, `npx vercel env pull`.
- For testing mode, `.env.local` needs `TEST_DATABASE_URL` (see `docs/development.md` > Testing mode).

## Deploying = pushing to `main`

There are no PRs or branches by default. **Every push to `main` deploys to the live site within a minute.** So the bar for a commit is "safe to go live right now".

Before every commit:
1. `npm run check` (or `just check`) passes: typecheck server + client, lint, unit tests. The pre-commit hook in `.githooks/` runs it automatically; never bypass it with `--no-verify` unless the user explicitly says to.
2. Anything that writes data was tried in **testing mode** (`just test-up`, http://localhost:5174), not against real data.
3. The docs above are updated in the same commit if the change is something a user or developer would notice (new feature, changed flow, new command, new setting, new route).
4. Push only when the user asks. After pushing, mention that GitHub Actions re-runs the checks and Vercel deploys.

## Hard rules

- **Never write to the production database** (`DATABASE_URL`). Use testing mode (`TEST_DATABASE_URL`) for anything that creates, edits or deletes data. Only touch production data when the user explicitly asks for that specific change, and say exactly what will change first.
- **Schema changes are additive only.** `server/src/schema.ts` runs on every server start against whatever database it's connected to, including production. Add tables, or nullable columns with `ADD COLUMN IF NOT EXISTS`. Never rename or drop a column/table in the same deploy that stops using it.
- **History can't be lost.** Played games/expansions can't be deleted (enforced server-side); keep it that way.
- Don't commit `.env*` or `.test-mode/`.
- The database is the only copy of the data (no CSV or local backup); Neon restore points are the backup.
- New write endpoints need `requireAuth` (see `server/src/auth.ts`).
- Always use `sql` tagged templates for queries (values are sent separately); never build SQL from strings or use `sql.unsafe` with user input.
- Never send raw error details to the browser on the live site; throw `UserError`-style messages for things users should see.

## Commit messages

Conventional-commit style, imperative, lower-case summary under ~70 characters:

```
<type>: <what changed>

<optional body: why, and anything a teammate needs to know (schema change, new env var, manual step)>
```

Types: `feat` (user-visible feature), `fix` (bug), `docs` (README/CLAUDE.md only), `refactor` (no behaviour change), `test`, `chore` (tooling, deps, CI), `data` (a deliberate change to production data, e.g. a rename; say what and why in the body).

Examples: `feat: add past game nights`, `fix: keep 1am games on the night they started`, `chore: add pre-commit check`.

One logical change per commit. Who made a change is recorded by git (author) and Vercel (which commit each deploy came from), so don't add names or dates to messages or files. Flag in the body anything that needs a manual step: `Needs: new env var BGG_TOKEN in Vercel`.

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | Install everything and enable the git hooks (first time) |
| `just test-up` / `just test-down` | Start / stop testing mode in the background (:5174 site, :3002 API, test database) |
| `just check` / `npm run check` | Everything CI runs |
| `npm test` | Unit tests only (Vitest) |
| `npm run dev` | Real database. Only for read-only or visual work |
| `npm run db:setup -- --test` | Create the tables (script in `server/scripts/`) |

## Tests

Lightweight, pure-logic unit tests only (no database, no browser): `*.test.ts` next to the code they cover. When you change stats rules (`server/src/stats.ts`) or date/time logic (`client/src/time.ts`), add or update a test. Keep logic you want to test in plain functions, out of components and SQL.
