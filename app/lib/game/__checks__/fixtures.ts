import { createGame } from '../engine';
import { DEFAULT_SETTINGS } from '../types';
import type { GameMode, GameState, Settings } from '../types';

export const settingsFor = (mode: GameMode, patch: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  mode,
  ...patch,
});

export const newGame = (mode: GameMode, patch: Partial<Settings> = {}): GameState =>
  createGame(settingsFor(mode, patch));

export const emptyCells = (game: GameState): number[] =>
  game.board.flatMap((cell, index) => (cell === null ? [index] : []));
