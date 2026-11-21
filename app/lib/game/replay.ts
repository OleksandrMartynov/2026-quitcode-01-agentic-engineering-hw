import { applyMove, createGame } from './engine';
import { otherPlayer } from './rules';
import { DEFAULT_SETTINGS } from './types';
import type { GameState, MatchRecord } from './types';

/**
 * Longest move list stored with a match. Classic and Grand end after at most
 * 25 moves, but a Vanishing game never fills the board and can in principle go
 * on forever — past this cap the match is kept without its replay.
 */
export const MAX_STORED_MOVES = 300;

type ReplaySource = Pick<MatchRecord, 'mode' | 'size' | 'winLength' | 'players' | 'difficulty'> & {
  opponent: MatchRecord['opponent'];
};

const replayStart = (record: ReplaySource): GameState =>
  createGame({
    ...DEFAULT_SETTINGS,
    mode: record.mode,
    size: record.size,
    winLength: record.winLength,
    opponent: record.opponent,
    difficulty: record.difficulty ?? DEFAULT_SETTINGS.difficulty,
    playerXName: record.players.X,
    playerOName: record.players.O,
  });

/**
 * Every position of a stored match, from the empty board (frame 0) to the
 * final one, rebuilt through the engine. Returns null as soon as a move is
 * illegal — an occupied or off-board cell, or a move after the game ended —
 * so a tampered move list can never be shown as if it had been played.
 */
export const replayFrames = (record: ReplaySource, moves: readonly number[]): GameState[] | null => {
  const frames: GameState[] = [replayStart(record)];
  for (const cell of moves) {
    const previous = frames[frames.length - 1];
    const next = applyMove(previous, cell);
    if (next === previous) return null;
    frames.push(next);
  }
  return frames;
};

/**
 * True when replaying the moves reproduces the stored outcome exactly: the
 * same winner by a line, a draw, or — for a timeout — an unfinished position
 * in which the player on turn is the one who lost on time.
 */
export const movesMatchResult = (
  record: ReplaySource & Pick<MatchRecord, 'result' | 'reason'>,
  moves: readonly number[]
): boolean => {
  const frames = replayFrames(record, moves);
  if (frames === null) return false;
  const { outcome, current } = frames[frames.length - 1];

  switch (record.reason) {
    case 'line':
      return outcome.type === 'win' && outcome.winner === record.result;
    case 'draw':
      return outcome.type === 'draw';
    case 'timeout':
      return outcome.type === 'playing' && otherPlayer(current) === record.result;
  }
};
