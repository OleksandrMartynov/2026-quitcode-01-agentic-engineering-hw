import { describe, expect, it } from 'vitest';
import { newGame } from './__checks__/fixtures';
import { chooseMove, suggestMove } from './ai';
import { applyMove, applyTimeout } from './engine';

describe('chooseMove', () => {
  it('returns -1 for a finished game', () => {
    const won = [0, 3, 1, 4, 2].reduce(applyMove, newGame('classic'));
    expect(chooseMove(won)).toBe(-1);
    expect(chooseMove(applyTimeout(newGame('blitz')))).toBe(-1);
  });

  it('only ever picks an empty cell, at every level and in every mode', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const mode of ['classic', 'vanishing', 'grand', 'blitz'] as const) {
        const game = [0, 4].reduce(applyMove, newGame(mode, { difficulty }));
        const cell = chooseMove(game);
        expect(game.board[cell]).toBeNull();
      }
    }
  });
});

describe('suggestMove', () => {
  it('finds the winning move for the player on turn', () => {
    // X to move with 0 and 1 taken: the hint is 2, even though O threatens 3-4-5.
    const game = [0, 3, 1, 4].reduce(applyMove, newGame('classic', { difficulty: 'easy' }));
    expect(suggestMove(game)).toBe(2);
  });

  it('finds the only defence', () => {
    // X to move, O threatens 2-4-6 through 6: the hint blocks at 6.
    const game = [0, 4, 8, 2].reduce(applyMove, newGame('classic', { difficulty: 'easy' }));
    expect(suggestMove(game)).toBe(6);
  });

  it('plays hard regardless of the configured difficulty', () => {
    const game = [0, 4, 8, 2].reduce(applyMove, newGame('classic', { difficulty: 'easy' }));
    expect(suggestMove(game)).toBe(chooseMove({ ...game, settings: { ...game.settings, difficulty: 'hard' } }));
  });
});
