import { describe, expect, it } from 'vitest';
import { emptyCells, newGame } from './__checks__/fixtures';
import { pick, seededRandom } from './__checks__/random';
import { applyMove } from './engine';
import { EMPTY, code, createSearch, doMove, isFull, undoMove, wonAt } from './search';
import type { Search } from './search';
import type { GameMode, GameState, Settings } from './types';

/*
 * Differential test: `search.ts` is a hand-optimized second implementation of
 * the move rules. It must agree with `engine.ts#applyMove` — the source of
 * truth — on every position, in every mode, or the AI would be searching a
 * different game from the one on the screen.
 */

const toCells = (search: Search) =>
  Array.from(search.board, (value) => (value === EMPTY ? null : value === 1 ? 'X' : 'O'));

const VARIANTS: [GameMode, Partial<Settings>][] = [
  ['classic', {}],
  ['vanishing', {}],
  ['blitz', {}],
  ['grand', { size: 4, winLength: 4 }],
  ['grand', { size: 5, winLength: 4 }],
  ['grand', { size: 5, winLength: 5 }],
];

const GAMES_PER_VARIANT = 200;
/** Vanishing games never fill the board, so they need a length cap. */
const MAX_PLIES = 60;

describe('search mirror agrees with the engine', () => {
  it.each(VARIANTS)('%s %o', (mode, patch) => {
    const random = seededRandom(mode.length * 1000 + (patch.size ?? 0) * 10 + (patch.winLength ?? 0));

    for (let round = 0; round < GAMES_PER_VARIANT; round++) {
      let game: GameState = newGame(mode, patch);
      const search = createSearch(game);

      for (let ply = 0; ply < MAX_PLIES && game.outcome.type === 'playing'; ply++) {
        const cell = pick(emptyCells(game), random);
        const player = code(game.current);
        const before = Array.from(search.board);
        const queuesBefore = search.queues.map((queue) => [...queue]);

        // do/undo must be an exact round trip...
        const removed = doMove(search, cell, player);
        undoMove(search, cell, player, removed);
        expect(Array.from(search.board)).toEqual(before);
        expect(search.queues).toEqual(queuesBefore);

        // ...and doing the move must land on the engine's position.
        const next = applyMove(game, cell);
        const removedAgain = doMove(search, cell, player);
        expect(removedAgain).toBe(next.moves.at(-1)?.removed ?? -1);
        expect(toCells(search)).toEqual(next.board);
        expect(search.queues).toEqual([next.queues.X, next.queues.O]);
        expect(wonAt(search, cell, player)).toBe(next.outcome.type === 'win');
        expect(isFull(search)).toBe(next.board.every((value) => value !== null));

        game = next;
      }
    }
  });
});
