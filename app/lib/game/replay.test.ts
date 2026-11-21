import { describe, expect, it } from 'vitest';
import { newGame } from './__checks__/fixtures';
import { pick, seededRandom } from './__checks__/random';
import { applyMove, applyTimeout } from './engine';
import { MAX_STORED_MOVES, movesMatchResult, replayFrames } from './replay';
import { toMatchRecord } from './stats';
import type { GameMode, GameState, MatchRecord } from './types';

const recordOf = (game: GameState): MatchRecord => toMatchRecord(game, game.startedAt + 1000);

describe('replayFrames', () => {
  it('rebuilds every position from the empty board to the end', () => {
    const game = [0, 3, 1, 4, 2].reduce(applyMove, newGame('classic'));
    const frames = replayFrames(recordOf(game), [0, 3, 1, 4, 2])!;
    expect(frames).toHaveLength(6);
    expect(frames[0].board.every((cell) => cell === null)).toBe(true);
    expect(frames[5].board).toEqual(game.board);
    expect(frames[5].outcome).toEqual(game.outcome);
  });

  it('shows the vanishing rule exactly as it happened', () => {
    const moves = [0, 3, 1, 4, 5, 8, 6];
    const source = {
      mode: 'vanishing' as const,
      size: 3,
      winLength: 3,
      opponent: 'human' as const,
      difficulty: null,
      players: { X: 'A', O: 'B' },
    };
    const frames = replayFrames(source, moves)!;
    expect(frames[6].board[0]).toBe('X');
    expect(frames[7].board[0]).toBeNull();
    expect(frames[7].moves.at(-1)?.removed).toBe(0);
  });

  it('returns null on the first illegal move', () => {
    const record = recordOf([0, 3, 1, 4, 2].reduce(applyMove, newGame('classic')));
    expect(replayFrames(record, [0, 0])).toBeNull();
    expect(replayFrames(record, [0, 3, 1, 4, 2, 5])).toBeNull();
    expect(replayFrames(record, [-1])).toBeNull();
  });
});

describe('movesMatchResult', () => {
  it('accepts every record the app itself writes (random games, all modes)', () => {
    const random = seededRandom(7);
    const modes: GameMode[] = ['classic', 'vanishing', 'grand', 'blitz'];
    for (let round = 0; round < 400; round++) {
      let game = newGame(modes[round % modes.length], { opponent: 'human' });
      for (let ply = 0; ply < 80 && game.outcome.type === 'playing'; ply++) {
        const empty = game.board.flatMap((cell, index) => (cell === null ? [index] : []));
        game = applyMove(game, pick(empty, random));
      }
      // Unfinished vanishing games end on the clock instead.
      if (game.outcome.type === 'playing') game = applyTimeout(game);
      const record = recordOf(game);
      expect(record.moves).not.toBeNull();
      expect(movesMatchResult(record, record.moves!)).toBe(true);
    }
  });

  it('rejects a list that reaches a different result', () => {
    const game = [0, 3, 1, 4, 2].reduce(applyMove, newGame('classic'));
    const record = recordOf(game);
    expect(movesMatchResult({ ...record, result: 'O' }, record.moves!)).toBe(false);
    expect(movesMatchResult({ ...record, reason: 'timeout' }, record.moves!)).toBe(false);
    expect(movesMatchResult(record, [0, 3, 1, 4])).toBe(false);
  });
});

describe('toMatchRecord and long games', () => {
  it('drops the move list of a game longer than MAX_STORED_MOVES', () => {
    const game = newGame('vanishing');
    const long: GameState = {
      ...game,
      moves: Array.from({ length: MAX_STORED_MOVES + 1 }, (_, i) => ({
        index: i % 9,
        player: i % 2 === 0 ? 'X' : 'O',
        removed: null,
      })),
      outcome: { type: 'win', winner: 'X', line: [0, 1, 2] },
    };
    expect(toMatchRecord(long).moves).toBeNull();
  });
});
