# API

All routes are in [`server/src/app.ts`](../server/src/app.ts) (cover routes in [`images.ts`](../server/src/images.ts)). On Vercel they run as one function from [`index.ts`](index.ts); locally from `server/src/index.ts`.

Responses are JSON. Errors come back as `{ "error": "message" }`. To log in, send the password to `/api/login` and pass the returned token as `Authorization: Bearer <token>`; testing mode needs no login.

Read endpoints accept `?legacy=0` to leave out legacy games. Endpoints marked 🔒 need a login.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/mode` | Test mode and BGG search on/off |
| POST | `/api/login` | Exchange the password for a token (10 wrong tries per address per 15 minutes) |
| POST | `/api/logout` | End the current login |
| GET | `/api/sessions/active` | The running session and its games |
| POST 🔒 | `/api/sessions` | Start a session |
| POST 🔒 | `/api/sessions/:id/end` | End the running session |
| DELETE 🔒 | `/api/sessions/:id` | Cancel the running session |
| POST 🔒 | `/api/sessions/past` | Add a past game night: `{ date, plays: [{ gameId, expansionIds, players, notes, endTime? }] }`, saved in the order given |
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

