import { describe, expect, it, vi } from 'vitest';

vi.mock('./db.js', () => ({ sql: () => { throw new Error('no database in unit tests'); } }));
const { summarize, standingsFor } = await import('./stats.js');
type Entry = import('./stats.js').Entry;

let nextId = 1;
const entry = (player: string, placement: number | null, opts: Partial<Entry> = {}): Entry => ({
  play_id: nextId++, session_id: 1, date: '2026-01-01', game_id: 1, game: 'Catan', expansions: null,
  player, score: null, placement, legacy: 0, players_in_play: 2, ...opts,
});

describe('summarize', () => {
  it('counts every win but only full games (2+ players) for win rate', () => {
    const s = summarize([
      entry('A', 1),
      entry('A', 2),
      entry('A', 1, { players_in_play: 1, legacy: 1 }), // winner-only legacy row
    ]);
    expect(s.wins).toBe(2);
    expect(s.played).toBe(3);
    expect(s.completePlayed).toBe(2);
    expect(s.winRate).toBe(0.5);
  });

  it('has no win rate without full games', () => {
    expect(summarize([entry('A', 1, { players_in_play: 1 })]).winRate).toBeNull();
  });

  it('counts distinct nights', () => {
    expect(summarize([entry('A', 1), entry('A', 2), entry('A', 1, { session_id: 2 })]).nights).toBe(2);
  });
});

describe('standingsFor', () => {
  it('ranks by wins, then win rate, then name', () => {
    const rows = [
      entry('Zed', 1), entry('Zed', 1), entry('Zed', 2),   // 2 wins, 67%
      entry('Amy', 1), entry('Amy', 1),                    // 2 wins, 100%
      entry('Bob', 1),                                     // 1 win
      entry('Cat', 1),                                     // 1 win, same rate as Bob
    ];
    expect(standingsFor(rows).map(r => r.name)).toEqual(['Amy', 'Zed', 'Bob', 'Cat']);
  });

  it('reports the best score, ignoring missing ones', () => {
    const [a] = standingsFor([entry('A', 1, { score: 40 }), entry('A', 2, { score: 55 }), entry('A', 1)]);
    expect(a.bestScore).toBe(55);
  });
});
