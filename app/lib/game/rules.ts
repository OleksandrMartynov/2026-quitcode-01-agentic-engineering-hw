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

export type WinnerResult = { winner: Player; line: number[] };

export const findWinner = (board: Board, lines: number[][]): WinnerResult | null => {
  for (const line of lines) {
    const first = board[line[0]];
    if (first === null) continue;
    if (line.every((index) => board[index] === first)) {
      return { winner: first, line };
    }
  }
  return null;
};

export const isBoardFull = (board: Board): boolean => board.every((cell) => cell !== null);

export const otherPlayer = (player: Player): Player => (player === 'X' ? 'O' : 'X');
