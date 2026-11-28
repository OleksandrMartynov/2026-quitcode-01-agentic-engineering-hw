import { describe, expect, it } from 'vitest';
import { chooseMove } from '../ai';
import { applyMove } from '../engine';
import { newGame } from './fixtures';

/*
 * A wall-clock budget, so it lives apart from the other checks: coverage
 * instrumentation slows the search down several times, and a timing measured
 * under it says nothing about the real app. `npm run test:coverage` excludes
 * this file and CI runs it on its own (`npm run test:speed`).
 */

/** Well inside one interaction; the measured worst case is ~15 ms locally. */
const BUDGET_MS = 250;

describe('grand boards stay responsive', () => {
  it.each([
    { size: 4, winLength: 4 },
    { size: 5, winLength: 4 },
    { size: 5, winLength: 5 },
  ])('$size x $size, $winLength in a row: every hard move is under the budget', ({ size, winLength }) => {
    let slowest = 0;
    let state = newGame('grand', { size, winLength, difficulty: 'hard', opponent: 'human' });
    for (let ply = 0; ply < size * size && state.outcome.type === 'playing'; ply++) {
      const started = performance.now();
      const cell = chooseMove(state);
      slowest = Math.max(slowest, performance.now() - started);
      state = applyMove(state, cell);
    }
    expect(slowest).toBeLessThan(BUDGET_MS);
  });
});
