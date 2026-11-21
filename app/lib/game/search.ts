import { MODES } from './types';
import type { GameState, Player } from './types';

export const EMPTY = 0;

/**
 * A fast, mutable mirror of the move rules for the AI search.
 *
 * `engine.ts#applyMove` is the authoritative implementation; this module
 * re-implements the same place-then-vanish-then-check order with do/undo on a
 * typed array, because cloning a GameState for every search node is far too
 * slow for the 5x5 search. Duplicated rules drift, so the two are
 * pinned together by a differential test (`search.test.ts`) that plays random
 * games in every mode and compares them after each move.
 */
export type Search = {
  board: Int8Array;
  queues: [number[], number[]];
  linesByCell: number[][];
  lines: number[][];
  maxMarks: number;
  size: number;
};

export const code = (player: Player): 1 | 2 => (player === 'X' ? 1 : 2);

export const createSearch = (state: GameState): Search => {
  const board = new Int8Array(state.board.length);
  state.board.forEach((cell, index) => {
    board[index] = cell === null ? EMPTY : code(cell);
  });

  const linesByCell: number[][] = Array.from({ length: board.length }, () => []);
  state.lines.forEach((line, lineIndex) => {
    for (const cell of line) linesByCell[cell].push(lineIndex);
  });

  return {
    board,
    queues: [[...state.queues.X], [...state.queues.O]],
    linesByCell,
    lines: state.lines,
    maxMarks: MODES[state.settings.mode].maxMarks,
    size: state.settings.size,
  };
};

export const doMove = (search: Search, cell: number, player: 1 | 2): number => {
  search.board[cell] = player;
  const queue = search.queues[player - 1];
  queue.push(cell);
  if (queue.length > search.maxMarks) {
    const removed = queue.shift() as number;
    search.board[removed] = EMPTY;
    return removed;
  }
  return -1;
};

export const undoMove = (search: Search, cell: number, player: 1 | 2, removed: number): void => {
  const queue = search.queues[player - 1];
  if (removed >= 0) {
    search.board[removed] = player;
    queue.unshift(removed);
  }
  queue.pop();
  search.board[cell] = EMPTY;
};

/** Only lines through the played cell can have been completed by that move. */
export const wonAt = (search: Search, cell: number, player: 1 | 2): boolean =>
  search.linesByCell[cell].some((lineIndex) =>
    search.lines[lineIndex].every((index) => search.board[index] === player)
  );

export const isFull = (search: Search): boolean => !search.board.includes(EMPTY);
