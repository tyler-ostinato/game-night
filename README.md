# Game Night

Tracks our game nights: who played, who won, scores, records, and stats for each player and each game.

**Live site:** hosted on Vercel. Viewing is open to everyone; making changes needs the password.

- [Using the site](#the-site): the tabs, logging a game night, adding a past night, covers
- [How the stats work](#how-the-stats-work): what counts toward wins, win rates and head-to-head
- [Working on the code](#working-on-the-code): setup, testing, deploying

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

**Legacy data:** games copied from before the site existed are flagged `legacy`. It came from a handwritten notebook and mostly records only the winner. Everything entered on the site is non-legacy.

**Full games:** a game where more than one player was recorded.
- **Counted for all games:** wins and games played.
- **Counted only for full games:** win rate, win streaks and head-to-head. Otherwise someone with one recorded game (a win) would show 100%. The site marks these stats with \*.

**Head-to-head:** in a full game, finishing with a better placement counts as beating that player. Some legacy games list everyone but only mark the winner; there, the winner counts as beating everyone else at the table.

**Ranking:** most wins, then best win rate, then name. Tied players share a place: two 1st places, then 3rd. Crowns and podium spots need at least one win.


## Password

- **Viewing** is public.
- **Making changes** needs the password: logging in, starting, ending or cancelling sessions, adding games or players, and editing games, expansions or covers.
- **Logins** last 30 days per device. **Log out** is at the top right.
- **If the password may have leaked,** change it in Vercel: that logs everyone out. Security details are in [docs/development.md](docs/development.md#password).

## Working on the code

You need Node 22+ and access to the Vercel project (ask Tyler to invite you). From the `game-night` folder:

```bash
npm run setup          # install everything and turn on the pre-commit check (first time)
npx vercel login && npx vercel link && npx vercel env pull   # get the settings (first time)
just test-up           # try things on a test database: http://localhost:5174
```

**Every push to `main` goes live within a minute.** Each commit runs a quick check first (typecheck, lint, tests), and anything that saves data should be tried in testing mode, never on the real data.

| Read this | For |
|---|---|
| [docs/development.md](docs/development.md) | Setup, commands, testing mode, hosting, deploying, settings, code map |
| [docs/data.md](docs/data.md) | Database tables, where the legacy data came from |
| [api/README.md](api/README.md) | Every API route |
| [CLAUDE.md](CLAUDE.md) | House rules: before-commit checklist, commit messages, database changes |
