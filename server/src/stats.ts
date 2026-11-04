import { db } from './db.js';

type Entry = {
  play_id: number; session_id: number; date: string; game_id: number; game: string; expansions: string | null
  player: string; score: number | null; placement: number | null; legacy: number; players_in_play: number
};

// A play is "complete" when more than one player was recorded. Most legacy plays only
// list the winner, so rates and streaks only count complete plays to stay fair.
const isComplete = (e: Entry) => e.players_in_play > 1;

function entries(includeLegacy: boolean): Entry[] {
  return db.prepare(`
    SELECT pl.id AS play_id, s.id AS session_id, s.date, g.id AS game_id, g.name AS game, p.name AS player, pp.score, pp.placement, pl.legacy,
      (SELECT group_concat(e.name, ', ') FROM play_expansions pe JOIN expansions e ON e.id = pe.expansion_id WHERE pe.play_id = pl.id) AS expansions,
      (SELECT count(*) FROM play_players WHERE play_id = pl.id) AS players_in_play
    FROM play_players pp
    JOIN plays pl ON pl.id = pp.play_id JOIN sessions s ON s.id = pl.session_id
    JOIN games g ON g.id = pl.game_id JOIN players p ON p.id = pp.player_id
    WHERE ? OR pl.legacy = 0
    ORDER BY s.date, pl.id`).all(includeLegacy ? 1 : 0) as Entry[];
}

const rate = (wins: number, played: number) => (played ? wins / played : null);

function summarize(mine: Entry[]) {
  const complete = mine.filter(isComplete);
  const wins = mine.filter(e => e.placement === 1).length;
  const completeWins = complete.filter(e => e.placement === 1).length;
  return {
    wins,
    played: mine.length,
    nights: new Set(mine.map(e => e.session_id)).size,
    completePlayed: complete.length,
    winRate: rate(completeWins, complete.length),
  };
}

export function playerList(includeLegacy = true) {
  const all = entries(includeLegacy);
  // Also list people added on the Players tab who haven't played anything yet.
  const unplayed = db.prepare('SELECT name FROM players WHERE id NOT IN (SELECT player_id FROM play_players)').pluck().all() as string[];
  const names = [...new Set([...all.map(e => e.player), ...unplayed])];
  return names
    .map(name => ({ name, ...summarize(all.filter(e => e.player === name)) }))
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
}

export function playerProfile(name: string, includeLegacy = true) {
  const all = entries(includeLegacy);
  const mine = all.filter(e => e.player === name);
  if (!mine.length) return null;

  // Per-game breakdown
  const games = new Map<string, Entry[]>();
  for (const e of mine) games.set(e.game, [...(games.get(e.game) ?? []), e]);
  const byGame = [...games].map(([game, es]) => {
    const complete = es.filter(isComplete);
    const scores = es.map(e => e.score).filter((s): s is number => s != null);
    return {
      game,
      played: es.length,
      wins: es.filter(e => e.placement === 1).length,
      winRate: rate(complete.filter(e => e.placement === 1).length, complete.length),
      completePlayed: complete.length,
      bestScore: scores.length ? Math.max(...scores) : null,
    };
  }).sort((a, b) => b.wins - a.wins || b.played - a.played);

  const pick = <T,>(xs: T[], score: (x: T) => number) => xs.reduce<T | null>((best, x) => (!best || score(x) > score(best) ? x : best), null);
  const mostWins = pick(byGame.filter(g => g.wins > 0), g => g.wins);
  const mostPlayed = pick(byGame, g => g.played);
  const bestRate = pick(byGame.filter(g => g.completePlayed >= 2 && g.winRate != null), g => g.winRate! * 1000 + g.completePlayed);

  // Streaks over complete plays, oldest first
  let longest = 0, run = 0;
  for (const e of mine.filter(isComplete)) {
    run = e.placement === 1 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  // Head-to-head over complete plays. A missing placement means "didn't win" (legacy
  // plays list everyone but only mark the winner), so it ranks behind any placement.
  const place = (e: Entry) => e.placement ?? Infinity;
  const h2h = new Map<string, { beat: number; lostTo: number }>();
  for (const e of mine.filter(isComplete)) {
    for (const o of all.filter(o => o.play_id === e.play_id && o.player !== name)) {
      const rec = h2h.get(o.player) ?? { beat: 0, lostTo: 0 };
      if (place(e) < place(o)) rec.beat++;
      else if (place(e) > place(o)) rec.lostTo++;
      h2h.set(o.player, rec);
    }
  }
  const headToHead = [...h2h].map(([opponent, r]) => ({ opponent, ...r }))
    .sort((a, b) => b.beat + b.lostTo - (a.beat + a.lostTo) || a.opponent.localeCompare(b.opponent));
  const nemesis = pick(headToHead.filter(h => h.lostTo > 0), h => h.lostTo * 1000 - h.beat);
  const favouriteOpponent = pick(headToHead.filter(h => h.beat > 0), h => h.beat * 1000 - h.lostTo);

  const firstWin = mine.find(e => e.placement === 1);
  return {
    name,
    ...summarize(mine),
    firstPlayed: mine[0].date,
    lastPlayed: mine[mine.length - 1].date,
    firstWin: firstWin ? { date: firstWin.date, game: firstWin.game } : null,
    mostWins: mostWins && { game: mostWins.game, wins: mostWins.wins },
    mostPlayed: mostPlayed && { game: mostPlayed.game, played: mostPlayed.played },
    bestWinRate: bestRate && { game: bestRate.game, winRate: bestRate.winRate, played: bestRate.completePlayed },
    longestStreak: longest,
    nemesis: nemesis && { name: nemesis.opponent, lostTo: nemesis.lostTo },
    favouriteOpponent: favouriteOpponent && { name: favouriteOpponent.opponent, beat: favouriteOpponent.beat },
    byGame,
    headToHead,
    history: mine.slice().reverse().map(e => ({
      playId: e.play_id, date: e.date, game: e.game, expansions: e.expansions,
      placement: e.placement, score: e.score, players: e.players_in_play, legacy: e.legacy,
    })),
  };
}

// Standings at one game: most wins first, then best win rate, then name.
function standingsFor(rows: Entry[]) {
  const byPlayer = new Map<string, Entry[]>();
  for (const e of rows) byPlayer.set(e.player, [...(byPlayer.get(e.player) ?? []), e]);
  return [...byPlayer].map(([name, es]) => {
    const complete = es.filter(isComplete);
    const scores = es.map(e => e.score).filter((s): s is number => s != null);
    return {
      name,
      wins: es.filter(e => e.placement === 1).length,
      played: es.length,
      winRate: rate(complete.filter(e => e.placement === 1).length, complete.length),
      bestScore: scores.length ? Math.max(...scores) : null,
    };
  }).sort((a, b) => b.wins - a.wins || (b.winRate ?? -1) - (a.winRate ?? -1) || a.name.localeCompare(b.name));
}

// Top of each game for the game tiles, using the same ranking as the game page.
export function gameChampions(includeLegacy = true) {
  const byGame = new Map<number, Entry[]>();
  for (const e of entries(includeLegacy)) byGame.set(e.game_id, [...(byGame.get(e.game_id) ?? []), e]);
  // Top three winners per game (players with at least one win), with shared places for ties.
  const podiums = new Map<number, { name: string; wins: number; place: number }[]>();
  for (const [gameId, rows] of byGame) {
    const winners = standingsFor(rows).filter(r => r.wins > 0);
    const top = winners.slice(0, 3).map(r => ({ name: r.name, wins: r.wins, place: 1 + winners.filter(o => o.wins > r.wins).length }));
    if (top.length) podiums.set(gameId, top);
  }
  return podiums;
}

export function gameStats(gameId: number, includeLegacy = true) {
  const rows = entries(includeLegacy).filter(e => e.game_id === gameId);
  // Plays come from the plays table so ones with nobody recorded still count.
  const playRows = db.prepare(`
    SELECT pl.id, pl.session_id, s.date, pl.legacy,
      (SELECT group_concat(e.name, ', ') FROM play_expansions pe JOIN expansions e ON e.id = pe.expansion_id WHERE pe.play_id = pl.id) AS expansions
    FROM plays pl JOIN sessions s ON s.id = pl.session_id
    WHERE pl.game_id = ? AND (? OR pl.legacy = 0)
    ORDER BY s.date, pl.id`).all(gameId, includeLegacy ? 1 : 0) as
    { id: number; session_id: number; date: string; legacy: number; expansions: string | null }[];

  const scored = rows.filter(e => e.score != null);
  const top = scored.reduce<Entry | null>((best, e) => (!best || e.score! > best.score! ? e : best), null);
  const winningScores = scored.filter(e => e.placement === 1).map(e => e.score!);
  const tableSizes = playRows.map(p => rows.filter(e => e.play_id === p.id).length).filter(n => n > 1);

  const expansionUse = new Map<string, number>();
  for (const p of playRows) {
    for (const name of p.expansions?.split(', ') ?? []) expansionUse.set(name, (expansionUse.get(name) ?? 0) + 1);
  }

  return {
    plays: playRows.length,
    nights: new Set(playRows.map(p => p.session_id)).size,
    players: new Set(rows.map(e => e.player)).size,
    firstPlayed: playRows[0]?.date ?? null,
    lastPlayed: playRows[playRows.length - 1]?.date ?? null,
    highScore: top && { player: top.player, score: top.score, date: top.date },
    avgWinningScore: winningScores.length ? Math.round(winningScores.reduce((a, b) => a + b, 0) / winningScores.length) : null,
    avgTableSize: tableSizes.length ? Math.round((tableSizes.reduce((a, b) => a + b, 0) / tableSizes.length) * 10) / 10 : null,
    standings: standingsFor(rows),
    expansions: [...expansionUse].map(([name, plays]) => ({ name, plays })).sort((a, b) => b.plays - a.plays),
    recent: playRows.slice().reverse().map(p => {
      const es = rows.filter(e => e.play_id === p.id);
      const scores = es.map(e => e.score).filter((s): s is number => s != null);
      return {
        playId: p.id, date: p.date, legacy: p.legacy, expansions: p.expansions,
        winners: es.filter(e => e.placement === 1).map(e => e.player),
        topScore: scores.length ? Math.max(...scores) : null,
        players: es.length,
      };
    }),
  };
}
