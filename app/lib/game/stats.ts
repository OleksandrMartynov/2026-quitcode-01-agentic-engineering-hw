import { MAX_STORED_MOVES } from './replay';
import { EMPTY_SCOREBOARD, HISTORY_LIMIT } from './storage';
import { HUMAN } from './types';
import type { Difficulty, GameMode, GameState, MatchRecord, Scoreboard } from './types';

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
    moves:
      game.moves.length <= MAX_STORED_MOVES ? game.moves.map((move) => move.index) : null,
    rewound: game.assists.rewound,
    hinted: game.assists.hinted,
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
 *
 * `alreadyCounted` is the result this game last added to the scoreboard, as
 * remembered by the caller. It matters when the old record is no longer in
 * the history — evicted by HISTORY_LIMIT after games finished in another tab —
 * but its result is still part of the score.
 */
export const recordMatch = <S extends MatchStats>(
  stats: S,
  record: MatchRecord,
  alreadyCounted: MatchRecord['result'] | null = null
): S => {
  const previous =
    stats.history.find((entry) => entry.id === record.id)?.result ?? alreadyCounted;
  const withoutPrevious =
    previous === null ? stats.scoreboard : adjust(stats.scoreboard, previous, -1);

  return {
    ...stats,
    history: [record, ...stats.history.filter((entry) => entry.id !== record.id)].slice(
      0,
      HISTORY_LIMIT
    ),
    scoreboard: adjust(withoutPrevious, record.result, 1),
  };
};

export type Tally = { games: number; X: number; O: number; draws: number };

export type DifficultyTally = {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** Games in which a move was taken back or a hint was shown. */
  assisted: number;
  /** Unassisted games and the human's wins among them — the win rate's basis. */
  ownGames: number;
  ownWins: number;
};

export type Summary = {
  games: number;
  byMode: Partial<Record<GameMode, Tally>>;
  /** Games against the computer, from the human's (X's) point of view. */
  vsComputer: Partial<Record<Difficulty, DifficultyTally>>;
  /** Mean number of moves of the finished games, or null without games. */
  averageMoves: number | null;
  /**
   * The longest run of consecutive unassisted wins against the computer. A
   * rewound or hinted game breaks the run: a loss that was rewound into a win
   * is not a win of the player's own.
   */
  bestStreak: number;
};

export const isAssisted = (record: MatchRecord): boolean => record.rewound || record.hinted;

/**
 * Aggregates the stored history (newest first) into per-mode and per-level
 * results. Derived on demand rather than stored, so it can never disagree with
 * the records it is built from.
 */
export const summarize = (history: readonly MatchRecord[]): Summary => {
  const byMode: Summary['byMode'] = {};
  const vsComputer: Summary['vsComputer'] = {};
  let totalMoves = 0;
  let streak = 0;
  let bestStreak = 0;

  // Oldest first, so the streak follows the order the games were played in.
  for (const record of [...history].reverse()) {
    totalMoves += record.moveCount;

    const tally = byMode[record.mode] ?? { games: 0, X: 0, O: 0, draws: 0 };
    tally.games += 1;
    if (record.result === 'draw') tally.draws += 1;
    else tally[record.result] += 1;
    byMode[record.mode] = tally;

    if (record.opponent === 'ai' && record.difficulty !== null) {
      const level = vsComputer[record.difficulty] ?? {
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        assisted: 0,
        ownGames: 0,
        ownWins: 0,
      };
      const won = record.result === HUMAN;
      level.games += 1;
      if (record.result === 'draw') level.draws += 1;
      else if (won) level.wins += 1;
      else level.losses += 1;

      if (isAssisted(record)) {
        level.assisted += 1;
        streak = 0;
      } else {
        level.ownGames += 1;
        if (won) level.ownWins += 1;
        streak = won ? streak + 1 : 0;
      }
      bestStreak = Math.max(bestStreak, streak);
      vsComputer[record.difficulty] = level;
    }
  }

  return {
    games: history.length,
    byMode,
    vsComputer,
    averageMoves: history.length === 0 ? null : totalMoves / history.length,
    bestStreak,
  };
};
