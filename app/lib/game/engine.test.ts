import { describe, expect, it } from 'vitest';
import { newGame } from './__checks__/fixtures';
import { applyMove, applyTimeout, createGame, doomedMarks, rewindTo } from './engine';
import type { GameState } from './types';
import { DEFAULT_SETTINGS } from './types';

const playAll = (game: GameState, cells: number[]): GameState => cells.reduce(applyMove, game);

describe('createGame', () => {
  it('normalizes impossible settings instead of building a broken board', () => {
    const game = createGame({ ...DEFAULT_SETTINGS, mode: 'classic', size: 7, winLength: 9 });
    expect(game.settings.size).toBe(3);
    expect(game.settings.winLength).toBe(3);
    expect(game.board).toHaveLength(9);
    expect(game.lines).toHaveLength(8);
  });

  it('gives every game its own id', () => {
    expect(newGame('classic').id).not.toBe(newGame('classic').id);
  });
});

describe('applyMove', () => {
  it('alternates players and records the move', () => {
    const game = playAll(newGame('classic'), [4, 0]);
    expect(game.board[4]).toBe('X');
    expect(game.board[0]).toBe('O');
    expect(game.current).toBe('X');
    expect(game.moves).toEqual([
      { index: 4, player: 'X', removed: null },
      { index: 0, player: 'O', removed: null },
    ]);
  });

  it('ignores taken cells, off-board cells and moves after the game is over', () => {
    const start = applyMove(newGame('classic'), 4);
    expect(applyMove(start, 4)).toBe(start);
    expect(applyMove(start, -1)).toBe(start);
    expect(applyMove(start, 9)).toBe(start);

    const won = playAll(newGame('classic'), [0, 3, 1, 4, 2]);
    expect(won.outcome).toEqual({ type: 'win', winner: 'X', line: [0, 1, 2] });
    expect(applyMove(won, 8)).toBe(won);
  });

  it('declares a draw on a full board without a line', () => {
    const game = playAll(newGame('classic'), [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(game.outcome).toEqual({ type: 'draw' });
  });

  it('does not mutate the previous state', () => {
    const before = newGame('classic');
    const snapshot = JSON.stringify(before);
    applyMove(before, 4);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('vanishing rule', () => {
  it('removes the oldest mark when a fourth one is placed', () => {
    // X: 0, 1, 5 then 6 -> mark at 0 vanishes. O: 3, 4, 8.
    const game = playAll(newGame('vanishing'), [0, 3, 1, 4, 5, 8, 6]);
    expect(game.board[0]).toBeNull();
    expect(game.board[6]).toBe('X');
    expect(game.queues.X).toEqual([1, 5, 6]);
    expect(game.moves.at(-1)).toEqual({ index: 6, player: 'X', removed: 0 });
  });

  it('removes the mark before checking for a win, so it cannot complete a line', () => {
    // X holds 0, 1, 4 (oldest 0). Playing 2 would make 0-1-2, but 0 vanishes first.
    const game = playAll(newGame('vanishing'), [0, 3, 1, 5, 4, 7, 2]);
    expect(game.board[0]).toBeNull();
    expect(game.outcome.type).toBe('playing');
  });

  it('marks the oldest mark of a full queue as doomed', () => {
    const game = playAll(newGame('vanishing'), [0, 3, 1, 4, 8]);
    expect(doomedMarks(game)).toEqual([0]);
    expect(doomedMarks(playAll(newGame('classic'), [0, 3, 1, 4, 8]))).toEqual([]);
  });

  it('dooms nothing once the game is over, so the winning line is not faded', () => {
    // X wins 2-5-8 on move 9 with three marks on the board (8 is the oldest).
    const won = playAll(newGame('vanishing'), [0, 3, 1, 4, 8, 6, 5, 7, 2]);
    expect(won.outcome).toMatchObject({ type: 'win', winner: 'X' });
    expect(won.queues.X).toHaveLength(3);
    expect(doomedMarks(won)).toEqual([]);
  });
});

describe('applyTimeout', () => {
  it('awards the game to the player who was not on the clock', () => {
    const game = applyMove(newGame('blitz'), 4);
    expect(applyTimeout(game).outcome).toEqual({ type: 'timeout', winner: 'X' });
  });

  it('does nothing to a finished game', () => {
    const won = playAll(newGame('blitz'), [0, 3, 1, 4, 2]);
    expect(applyTimeout(won)).toBe(won);
  });
});

describe('rewindTo', () => {
  it('replays a prefix of the moves and keeps the game identity', () => {
    const game = playAll(newGame('vanishing'), [0, 3, 1, 4, 5, 8, 6]);
    const back = rewindTo(game, 3);
    expect(back.id).toBe(game.id);
    expect(back.startedAt).toBe(game.startedAt);
    expect(back.moves).toEqual(game.moves.slice(0, 3));
    expect(back.board).toEqual(playAll(newGame('vanishing'), [0, 3, 1]).board);
    expect(back.current).toBe('O');
  });

  it('turns a finished game back into a game in progress', () => {
    const won = playAll(newGame('classic'), [0, 3, 1, 4, 2]);
    expect(rewindTo(won, 4).outcome.type).toBe('playing');
  });
});
