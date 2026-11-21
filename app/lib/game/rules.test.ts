import { describe, expect, it } from 'vitest';
import { buildLines, findWinner, isBoardFull, otherPlayer } from './rules';
import type { Board } from './types';

describe('buildLines', () => {
  it.each([
    [3, 3, 8],
    [4, 4, 10],
    [5, 4, 28],
    [5, 5, 12],
  ])('a %ix%i board with %i in a row has %i lines', (size, winLength, expected) => {
    expect(buildLines(size, winLength)).toHaveLength(expected);
  });

  it('generates the eight classic lines exactly', () => {
    const lines = buildLines(3, 3).map((line) => line.join(','));
    expect(lines.sort()).toEqual(
      ['0,1,2', '3,4,5', '6,7,8', '0,3,6', '1,4,7', '2,5,8', '0,4,8', '2,4,6'].sort()
    );
  });

  it('keeps every cell on the board and every line straight', () => {
    for (const [size, winLength] of [
      [3, 3],
      [4, 4],
      [5, 4],
      [5, 5],
    ]) {
      for (const line of buildLines(size, winLength)) {
        expect(line).toHaveLength(winLength);
        expect(line.every((cell) => cell >= 0 && cell < size * size)).toBe(true);
        const steps = line.slice(1).map((cell, i) => cell - line[i]);
        expect(new Set(steps).size).toBe(1);
      }
    }
  });

  it('does not wrap the anti-diagonal around the board edge', () => {
    // On 5x5 with 4 in a row, cell 3 -> 7 -> 11 -> 15 is a real anti-diagonal,
    // but 2 -> 6 -> 10 -> 14 would wrap from column 0 to column 4.
    const keys = buildLines(5, 4).map((line) => line.join(','));
    expect(keys).toContain('3,7,11,15');
    expect(keys).not.toContain('2,6,10,14');
  });
});

describe('findWinner', () => {
  const lines = buildLines(3, 3);

  it('finds a diagonal winner and returns its line', () => {
    const board: Board = ['X', 'O', null, 'O', 'X', null, null, null, 'X'];
    expect(findWinner(board, lines)).toEqual({ winner: 'X', line: [0, 4, 8] });
  });

  it('highlights every line a single move completes', () => {
    // One move at 0 completes the top row 0-1-2 and the diagonal 0-4-8.
    const board: Board = ['X', 'X', 'X', 'O', 'X', 'O', 'O', 'O', 'X'];
    expect(findWinner(board, lines)).toEqual({ winner: 'X', line: [0, 1, 2, 4, 8] });

    // 5x5, four in a row: X on 0-4 completes [0..3] and [1..4].
    const wide: Board = Array(25).fill(null);
    for (const cell of [0, 1, 2, 3, 4]) wide[cell] = 'X';
    expect(findWinner(wide, buildLines(5, 4))?.line).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns null without a complete line', () => {
    const board: Board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    expect(findWinner(board, lines)).toBeNull();
  });
});

describe('helpers', () => {
  it('isBoardFull and otherPlayer', () => {
    expect(isBoardFull(['X', 'O', 'X', 'O'])).toBe(true);
    expect(isBoardFull(['X', null])).toBe(false);
    expect(otherPlayer('X')).toBe('O');
    expect(otherPlayer('O')).toBe('X');
  });
});
