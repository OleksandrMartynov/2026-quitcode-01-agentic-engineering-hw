import { EMPTY_SCOREBOARD, HISTORY_LIMIT } from './storage';
import type { GameState, MatchRecord, Scoreboard } from './types';

/** History and scoreboard change together, so they live in one value. */
export type MatchStats = { history: MatchRecord[]; scoreboard: Scoreboard };

export const EMPTY_STATS: MatchStats = { history: [], scoreboard: EMPTY_SCOREBOARD };

/** Builds the history entry for a finished game. */
export const toMatchRecord = (game: GameState, now: number = Date.now()): MatchRecord => {
  const { outcome, settings } = game;
  if (outcome.type === 'playing') {
    throw new Error('toMatchRecord: the game is still in progress');
  }

  return {
    id: game.id,
    playedAt: new Date(now).toISOString(),
    mode: settings.mode,
    opponent: settings.opponent,
    difficulty: settings.opponent === 'ai' ? settings.difficulty : null,
    size: settings.size,
    winLength: settings.winLength,
    players: { X: settings.playerXName, O: settings.playerOName },
    result: outcome.type === 'draw' ? 'draw' : outcome.winner,
    reason: outcome.type === 'win' ? 'line' : outcome.type,
    moveCount: game.moves.length,
    durationMs: Math.max(0, now - game.startedAt),
  };
};

const adjust = (scoreboard: Scoreboard, result: MatchRecord['result'], delta: 1 | -1): Scoreboard => {
  const key = result === 'draw' ? 'draws' : result;
  return { ...scoreboard, [key]: Math.max(0, scoreboard[key] + delta) };
};

/**
 * Adds a finished match. A game that was rewound and finished again keeps its
 * id, so it REPLACES its earlier record instead of being appended: the old
 * result leaves the scoreboard and the new one enters it. Every game is
 * therefore counted exactly once, however often it is replayed, and calling
 * this twice with the same record is a no-op for the scoreboard.
 */
export const recordMatch = (stats: MatchStats, record: MatchRecord): MatchStats => {
  const previous = stats.history.find((entry) => entry.id === record.id);
  const withoutPrevious = previous ? adjust(stats.scoreboard, previous.result, -1) : stats.scoreboard;

  return {
    history: [record, ...stats.history.filter((entry) => entry.id !== record.id)].slice(
      0,
      HISTORY_LIMIT
    ),
    scoreboard: adjust(withoutPrevious, record.result, 1),
  };
};
