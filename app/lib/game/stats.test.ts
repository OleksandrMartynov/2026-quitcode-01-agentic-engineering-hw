import { describe, expect, it } from 'vitest';
import { newGame } from './__checks__/fixtures';
import { applyMove, applyTimeout, markHinted, rewindTo } from './engine';
import { EMPTY_STATS, recordMatch, summarize, toMatchRecord } from './stats';
import { HISTORY_LIMIT } from './storage';
import type { GameState, MatchRecord } from './types';

const playAll = (game: GameState, cells: number[]): GameState => cells.reduce(applyMove, game);

const record = (id: string, result: MatchRecord['result']): MatchRecord => ({
  id,
  playedAt: '2026-09-06T10:00:00.000Z',
  mode: 'classic',
  opponent: 'human',
  difficulty: null,
  size: 3,
  winLength: 3,
  players: { X: 'A', O: 'B' },
  result,
  reason: result === 'draw' ? 'draw' : 'line',
  moveCount: 5,
  durationMs: 1000,
  moves: null,
  rewound: false,
  hinted: false,
});

describe('toMatchRecord', () => {
  it('describes a won game, including the player names at the time', () => {
    const game = playAll(newGame('classic', { opponent: 'human', playerXName: 'Ann' }), [0, 3, 1, 4, 2]);
    expect(toMatchRecord(game, game.startedAt + 4200)).toMatchObject({
      id: game.id,
      result: 'X',
      reason: 'line',
      difficulty: null,
      moveCount: 5,
      durationMs: 4200,
      players: { X: 'Ann', O: 'Rival' },
      moves: [0, 3, 1, 4, 2],
    });
  });

  it('carries the assists of the game', () => {
    const won = [0, 3, 1, 4, 2].reduce(applyMove, newGame('classic'));
    expect(toMatchRecord(won)).toMatchObject({ rewound: false, hinted: false });
    const rewound = applyMove(rewindTo(won, 4), 2);
    expect(toMatchRecord(rewound)).toMatchObject({ rewound: true, hinted: false });
    const hinted = applyMove(markHinted([0, 3, 1, 4].reduce(applyMove, newGame('classic'))), 2);
    expect(toMatchRecord(hinted)).toMatchObject({ rewound: false, hinted: true });
  });

  it('describes a draw and a timeout', () => {
    const draw = playAll(newGame('classic'), [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(toMatchRecord(draw)).toMatchObject({ result: 'draw', reason: 'draw', difficulty: 'medium' });

    const timeout = applyTimeout(applyMove(newGame('blitz'), 4));
    expect(toMatchRecord(timeout)).toMatchObject({ result: 'X', reason: 'timeout' });
  });

  it('refuses a game that is still being played', () => {
    expect(() => toMatchRecord(newGame('classic'))).toThrow();
  });
});

describe('recordMatch', () => {
  it('adds new matches to the top and counts them', () => {
    const stats = [record('a', 'X'), record('b', 'draw'), record('c', 'O')].reduce(
      (stats, entry) => recordMatch(stats, entry),
      EMPTY_STATS
    );
    expect(stats.history.map((entry) => entry.id)).toEqual(['c', 'b', 'a']);
    expect(stats.scoreboard).toEqual({ X: 1, O: 1, draws: 1 });
  });

  it('is idempotent for the same record', () => {
    const once = recordMatch(EMPTY_STATS, record('a', 'X'));
    expect(recordMatch(once, record('a', 'X'))).toEqual(once);
  });

  it('replaces a replayed game instead of counting it twice', () => {
    const lost = recordMatch(EMPTY_STATS, record('a', 'O'));
    const replayed = recordMatch(lost, record('a', 'X'));
    expect(replayed.history).toHaveLength(1);
    expect(replayed.history[0].result).toBe('X');
    expect(replayed.scoreboard).toEqual({ X: 1, O: 0, draws: 0 });
  });

  it('takes a remembered result out of the score when the record was evicted', () => {
    // The game's record fell out of the history, but its X win is still counted.
    const stats = { history: [], scoreboard: { X: 5, O: 0, draws: 0 } };
    expect(recordMatch(stats, record('a', 'O'), 'X').scoreboard).toEqual({ X: 4, O: 1, draws: 0 });
    // Without a remembered result the game is simply added.
    expect(recordMatch(stats, record('a', 'O')).scoreboard).toEqual({ X: 5, O: 1, draws: 0 });
  });

  it('cannot be farmed by rewinding the same finished game over and over', () => {
    const won = playAll(newGame('classic', { opponent: 'human' }), [0, 3, 1, 4, 2]);
    let stats = recordMatch(EMPTY_STATS, toMatchRecord(won));
    for (let i = 0; i < 10; i++) {
      const again = applyMove(rewindTo(won, 4), 2);
      expect(again.id).toBe(won.id);
      stats = recordMatch(stats, toMatchRecord(again));
    }
    expect(stats.history).toHaveLength(1);
    expect(stats.scoreboard).toEqual({ X: 1, O: 0, draws: 0 });
  });

  it('keeps at most HISTORY_LIMIT entries but keeps counting', () => {
    let stats = EMPTY_STATS;
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) stats = recordMatch(stats, record(`g${i}`, 'X'));
    expect(stats.history).toHaveLength(HISTORY_LIMIT);
    expect(stats.scoreboard.X).toBe(HISTORY_LIMIT + 5);
  });

  it('does not mutate its input', () => {
    const before = recordMatch(EMPTY_STATS, record('a', 'X'));
    const snapshot = JSON.stringify(before);
    recordMatch(before, record('a', 'O'));
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('summarize', () => {
  const vsAi = (id: string, result: MatchRecord['result'], difficulty: MatchRecord['difficulty']) => ({
    ...record(id, result),
    opponent: 'ai' as const,
    difficulty,
  });

  it('is empty without games', () => {
    expect(summarize([])).toEqual({
      games: 0,
      byMode: {},
      vsComputer: {},
      averageMoves: null,
      bestStreak: 0,
    });
  });

  it('tallies by mode and by level from the human point of view', () => {
    // Newest first, as the history is stored.
    const history = [
      vsAi('e', 'O', 'hard'),
      vsAi('d', 'X', 'easy'),
      vsAi('c', 'X', 'easy'),
      { ...record('b', 'draw'), mode: 'blitz' as const },
      vsAi('a', 'draw', 'hard'),
    ];
    const summary = summarize(history);
    expect(summary.games).toBe(5);
    expect(summary.byMode).toEqual({
      classic: { games: 4, X: 2, O: 1, draws: 1 },
      blitz: { games: 1, X: 0, O: 0, draws: 1 },
    });
    expect(summary.vsComputer).toEqual({
      easy: { games: 2, wins: 2, losses: 0, draws: 0, assisted: 0, ownGames: 2, ownWins: 2 },
      hard: { games: 2, wins: 0, losses: 1, draws: 1, assisted: 0, ownGames: 2, ownWins: 0 },
    });
    expect(summary.averageMoves).toBe(5);
  });

  it('measures the streak in the order the games were played', () => {
    // Played oldest -> newest: W W L W W W  => best streak 3.
    const played = ['X', 'X', 'O', 'X', 'X', 'X'] as const;
    const history = played.map((result, i) => vsAi(`g${i}`, result, 'medium')).reverse();
    expect(summarize(history).bestStreak).toBe(3);
  });

  it('keeps assisted games out of the win rate and lets them break the streak', () => {
    // Played oldest -> newest: W, W (rewound), W, W, W (hinted), L.
    const played = [
      vsAi('g0', 'X', 'medium'),
      { ...vsAi('g1', 'X', 'medium'), rewound: true },
      vsAi('g2', 'X', 'medium'),
      vsAi('g3', 'X', 'medium'),
      { ...vsAi('g4', 'X', 'medium'), hinted: true },
      vsAi('g5', 'O', 'medium'),
    ];
    const summary = summarize([...played].reverse());
    expect(summary.vsComputer.medium).toEqual({
      games: 6,
      wins: 5,
      losses: 1,
      draws: 0,
      assisted: 2,
      ownGames: 4,
      ownWins: 3,
    });
    // g2-g3 is the longest run of own wins; g1 and g4 break the runs.
    expect(summary.bestStreak).toBe(2);
  });

  it('ignores two-player games for the streak', () => {
    const history = [vsAi('c', 'X', 'easy'), record('b', 'O'), vsAi('a', 'X', 'easy')];
    expect(summarize(history).bestStreak).toBe(2);
  });
});
