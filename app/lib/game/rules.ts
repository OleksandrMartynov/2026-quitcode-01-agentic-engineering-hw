import type { Board, Player } from './types';

/** Row, column and both diagonal directions as [rowStep, colStep]. */
const DIRECTIONS: readonly [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/**
 * Every winning line for a size x size board, generated instead of hard-coded,
 * so 3x3, 4x4 and 5x5 all share one implementation.
 */
export const buildLines = (size: number, winLength: number): number[][] => {
  const lines: number[][] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const [rowStep, colStep] of DIRECTIONS) {
        const endRow = row + rowStep * (winLength - 1);
        const endCol = col + colStep * (winLength - 1);
        if (endRow >= size || endCol >= size || endCol < 0) continue;

        const line: number[] = [];
        for (let step = 0; step < winLength; step++) {
          line.push((row + rowStep * step) * size + (col + colStep * step));
        }
        lines.push(line);
      }
    }
  }

  return lines;
};

/** `line` holds every cell of every completed line, in ascending order. */
export type WinnerResult = { winner: Player; line: number[] };

/**
 * One move can complete several lines at once (a row and a diagonal, or two
 * overlapping 4-in-a-rows on 5x5), and all of them are highlighted. Only the
 * player who just moved can have a line, so a single winner is guaranteed.
 */
export const findWinner = (board: Board, lines: number[][]): WinnerResult | null => {
  let winner: Player | null = null;
  const cells = new Set<number>();
  for (const line of lines) {
    const first = board[line[0]];
    if (first === null || !line.every((index) => board[index] === first)) continue;
    winner = first;
    for (const index of line) cells.add(index);
  }
  return winner === null ? null : { winner, line: [...cells].sort((a, b) => a - b) };
};

export const isBoardFull = (board: Board): boolean => board.every((cell) => cell !== null);

export const otherPlayer = (player: Player): Player => (player === 'X' ? 'O' : 'X');
