import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseMove } from '../ai';
import { applyMove } from '../engine';
import { MODES } from '../types';
import type { Difficulty, GameMode, GameState, Player, Settings } from '../types';
import { emptyCells, newGame } from './fixtures';
import { pick, seededRandom } from './random';

/*
 * Engine-level verification of the computer opponent: whole games are played
 * in Node, no UI involved. This is the check that was first run by hand during
 * the vibe session (480 games) and is now part of `npm test`, so a change to
 * the rules or to the search cannot silently weaken the AI.
 */

type Strategy = Difficulty | 'random';

const MAX_PLIES = 120;

const playMatch = (
  mode: GameMode,
  strategies: Record<Player, Strategy>,
  random: () => number,
  patch: Partial<Settings> = {}
): GameState => {
  let game = newGame(mode, { opponent: 'human', ...patch });
  for (let ply = 0; ply < MAX_PLIES && game.outcome.type === 'playing'; ply++) {
    const strategy = strategies[game.current];
    const cell =
      strategy === 'random'
        ? pick(emptyCells(game), random)
        : chooseMove({ ...game, settings: { ...game.settings, difficulty: strategy } });
    expect(game.board[cell]).toBeNull();
    game = applyMove(game, cell);
  }
  return game;
};

const winnerOf = (game: GameState): Player | 'draw' | 'unfinished' =>
  game.outcome.type === 'win' || game.outcome.type === 'timeout'
    ? game.outcome.winner
    : game.outcome.type === 'draw'
      ? 'draw'
      : 'unfinished';

const tally = (games: GameState[]) =>
  games.reduce<Record<string, number>>((counts, game) => {
    const key = winnerOf(game);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

let random: () => number;

beforeEach(() => {
  // The AI breaks ties with Math.random; seeding it makes every game replayable.
  const aiRandom = seededRandom(2026);
  vi.spyOn(Math, 'random').mockImplementation(aiRandom);
  random = seededRandom(42);
});

afterEach(() => vi.restoreAllMocks());

const run = <T,>(count: number, play: () => T): T[] => Array.from({ length: count }, play);

describe('hard AI on 3x3 is unbeatable (exhaustive search)', () => {
  it.each(['classic', 'blitz'] as const)('%s: hard as O never loses to random in 150 games', (mode) => {
    const results = tally(run(150, () => playMatch(mode, { X: 'random', O: 'hard' }, random)));
    expect(results.X ?? 0).toBe(0);
    expect(results.unfinished ?? 0).toBe(0);
  });

  it('classic: hard as X never loses to random in 150 games', () => {
    const results = tally(run(150, () => playMatch('classic', { X: 'hard', O: 'random' }, random)));
    expect(results.O ?? 0).toBe(0);
  });

  it('classic: hard never loses to medium in 150 games, playing either side', () => {
    const games = run(150, () => {
      const hard: Player = random() < 0.5 ? 'X' : 'O';
      const game = playMatch(
        'classic',
        hard === 'X' ? { X: 'hard', O: 'medium' } : { X: 'medium', O: 'hard' },
        random
      );
      return { hard, winner: winnerOf(game) };
    });
    const lostByHard = games.filter(({ hard, winner }) => winner !== 'draw' && winner !== hard);
    expect(lostByHard).toEqual([]);
  });

  it('classic: hard vs hard always ends in a draw (30 games)', () => {
    const results = tally(run(30, () => playMatch('classic', { X: 'hard', O: 'hard' }, random)));
    expect(results).toEqual({ draw: 30 });
  });
});

describe('vanishing', () => {
  it('never draws and never lets a player hold more than three marks (60 games)', () => {
    const games = run(60, () => playMatch('vanishing', { X: 'random', O: 'hard' }, random));
    for (const game of games) {
      expect(game.outcome.type).not.toBe('draw');
      expect(game.board.filter((cell) => cell === 'X').length).toBeLessThanOrEqual(3);
      expect(game.board.filter((cell) => cell === 'O').length).toBeLessThanOrEqual(3);
    }
    const results = tally(games);
    expect(results.X ?? 0).toBe(0);
  });
});

describe('medium AI', () => {
  it('takes an immediate win', () => {
    // O holds 0 and 1; X holds 3 and 4 and also threatens 5. Winning beats blocking.
    const game = [3, 0, 4, 1, 8].reduce(applyMove, newGame('classic', { difficulty: 'medium' }));
    expect(chooseMove(game)).toBe(2);
  });

  it('blocks an immediate threat', () => {
    const game = [0, 4, 1].reduce(applyMove, newGame('classic', { difficulty: 'medium' }));
    expect(chooseMove(game)).toBe(2);
  });
});

describe('grand boards stay responsive', () => {
  it.each([
    [4, 4],
    [5, 4],
    [5, 5],
  ])('%ix%i, %i in a row: every hard move takes under 250 ms', (size, winLength) => {
    let slowest = 0;
    let state = newGame('grand', { size, winLength, difficulty: 'hard', opponent: 'human' });
    for (let ply = 0; ply < size * size && state.outcome.type === 'playing'; ply++) {
      const started = performance.now();
      const cell = chooseMove(state);
      slowest = Math.max(slowest, performance.now() - started);
      state = applyMove(state, cell);
    }
    expect(slowest).toBeLessThan(250);
  });
});

describe('mode table', () => {
  it('marks a mode exhaustive only if the hard search reaches the end of the game', () => {
    for (const [mode, config] of Object.entries(MODES)) {
      const cells = Math.max(...config.sizes) ** 2;
      const reachesEnd = config.searchDepth(cells) >= cells && !Number.isFinite(config.maxMarks);
      expect([mode, config.exhaustiveSearch]).toEqual([mode, reachesEnd]);
    }
  });
});
