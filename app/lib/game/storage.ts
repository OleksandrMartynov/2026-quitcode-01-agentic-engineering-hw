import {
  DEFAULT_SETTINGS,
  DIFFICULTY_LEVELS,
  GAME_MODES,
  MODES,
  OPPONENTS,
  cleanName,
  normalizeSettings,
} from './types';
import { MAX_STORED_MOVES, movesMatchResult } from './replay';
import type { MatchRecord, Player, Scoreboard, Settings } from './types';

export const STORAGE_KEYS = {
  settings: 'ttt-lab:settings',
  history: 'ttt-lab:history',
  scoreboard: 'ttt-lab:scoreboard',
} as const;
const KEYS = STORAGE_KEYS;

export const EMPTY_SCOREBOARD: Scoreboard = { X: 0, O: 0, draws: 0 };

/** Keeps the stored history from growing without bound. */
export const HISTORY_LIMIT = 25;

/*
 * Everything read from localStorage is untrusted: another version of the app,
 * a browser extension or a user in DevTools may have written it. Each value is
 * therefore parsed field by field into a known shape, and anything that does
 * not fit is dropped or replaced by a default. A single bad entry must never
 * reach a render path — the app writes its state back after mounting, so a
 * crash on a stored value would otherwise repeat on every reload.
 */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const RESULTS = ['X', 'O', 'draw'] as const;
const REASONS = ['line', 'draw', 'timeout'] as const;

export const parseSettings = (raw: unknown): Settings => {
  const stored = isObject(raw) ? raw : {};
  const pick = <K extends keyof Settings>(key: K, valid: (value: unknown) => boolean): Settings[K] =>
    valid(stored[key]) ? (stored[key] as Settings[K]) : DEFAULT_SETTINGS[key];

  return normalizeSettings({
    mode: pick('mode', (value) => isOneOf(GAME_MODES, value)),
    size: pick('size', isCount),
    winLength: pick('winLength', isCount),
    opponent: pick('opponent', (value) => isOneOf(OPPONENTS, value)),
    difficulty: pick('difficulty', (value) => isOneOf(DIFFICULTY_LEVELS, value)),
    turnSeconds: pick('turnSeconds', isCount),
    playerXName: cleanName(stored.playerXName, DEFAULT_SETTINGS.playerXName),
    playerOName: cleanName(stored.playerOName, DEFAULT_SETTINGS.playerOName),
  });
};

/**
 * Rules every finished game obeys, whether or not its moves were stored:
 * X moves on odd turns, so a line win's parity names its winner; a timeout is
 * lost by the player on turn and only exists in timed modes; a draw needs a
 * full board, so Vanishing — whose board never fills — cannot have one.
 */
export const isPlausibleOutcome = (
  record: Pick<MatchRecord, 'mode' | 'size' | 'winLength' | 'result' | 'reason' | 'moveCount'>
): boolean => {
  const config = MODES[record.mode];
  const cells = record.size * record.size;
  const boardCanFill = !Number.isFinite(config.maxMarks);
  const lastMover: Player = record.moveCount % 2 === 1 ? 'X' : 'O';

  if (record.moveCount < 1) return false;
  if (boardCanFill && record.moveCount > cells) return false;

  switch (record.reason) {
    case 'line':
      return record.moveCount >= 2 * record.winLength - 1 && record.result === lastMover;
    case 'draw':
      return boardCanFill && record.moveCount === cells;
    case 'timeout':
      // The player on turn ran out of time, so the last mover is the winner.
      return config.timed && record.result === lastMover && record.moveCount < cells;
  }
};

/** Returns null for anything that is not a complete, internally consistent record. */
export const parseRecord = (raw: unknown): MatchRecord | null => {
  if (!isObject(raw)) return null;
  const { id, playedAt, mode, opponent, difficulty, size, winLength, result, reason } = raw;

  if (typeof id !== 'string' || id === '') return null;
  if (typeof playedAt !== 'string' || Number.isNaN(Date.parse(playedAt))) return null;
  if (!isOneOf(GAME_MODES, mode) || !isOneOf(OPPONENTS, opponent)) return null;
  if (!isCount(size) || !MODES[mode].sizes.includes(size)) return null;
  if (!isCount(winLength) || !MODES[mode].winLengths(size).includes(winLength)) return null;
  if (!isOneOf(RESULTS, result) || !isOneOf(REASONS, reason)) return null;
  // A draw is the only result without a winner, and the only one with reason 'draw'.
  if ((result === 'draw') !== (reason === 'draw')) return null;
  if (!isCount(raw.moveCount) || !isCount(raw.durationMs)) return null;

  let parsedDifficulty: MatchRecord['difficulty'] = null;
  if (opponent === 'ai') {
    if (!isOneOf(DIFFICULTY_LEVELS, difficulty)) return null;
    parsedDifficulty = difficulty;
  }

  // Records written before player names were stored fall back to the marks.
  const players = isObject(raw.players) ? raw.players : {};
  const names: Record<Player, string> = {
    X: cleanName(players.X, 'X'),
    O: cleanName(players.O, 'O'),
  };

  const record: MatchRecord = {
    id,
    playedAt,
    mode,
    opponent,
    difficulty: parsedDifficulty,
    size,
    winLength,
    players: names,
    result,
    reason,
    moveCount: raw.moveCount,
    durationMs: raw.durationMs,
    moves: null,
  };

  if (!isPlausibleOutcome(record)) return null;

  // Records written before moves were stored stay valid, just without a replay.
  if (raw.moves === undefined || raw.moves === null) return record;

  // A stored move list must be legal AND reproduce the stored result when it
  // is played through the engine — the record is checked by simulation, not
  // only by shape. A list that contradicts its own record means the entry was
  // tampered with or corrupted, so the whole record is dropped.
  const { moves } = raw;
  if (!Array.isArray(moves) || moves.length > MAX_STORED_MOVES) return null;
  if (!moves.every(isCount) || moves.length !== record.moveCount) return null;
  if (!movesMatchResult(record, moves)) return null;
  return { ...record, moves: [...moves] };
};

export const parseHistory = (raw: unknown): MatchRecord[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const history: MatchRecord[] = [];
  for (const entry of raw) {
    const record = parseRecord(entry);
    // Ids are React keys and the identity of a match — keep the newest copy only.
    if (record === null || seen.has(record.id)) continue;
    seen.add(record.id);
    history.push(record);
    if (history.length === HISTORY_LIMIT) break;
  }
  return history;
};

export const parseScoreboard = (raw: unknown): Scoreboard => {
  const stored = isObject(raw) ? raw : {};
  const count = (value: unknown) => (isCount(value) ? value : 0);
  return { X: count(stored.X), O: count(stored.O), draws: count(stored.draws) };
};

/**
 * localStorage is unavailable during SSR and can throw in private browsing, so
 * every read falls back to `undefined` (and then to defaults) instead of
 * taking the app down.
 */
const read = (key: string): unknown => {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
};

const write = (key: string, value: unknown): void => {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(value);
    // Skipping identical writes keeps open tabs from echoing each other's
    // updates back and forth through the storage event.
    if (window.localStorage.getItem(key) === serialized) return;
    window.localStorage.setItem(key, serialized);
  } catch {
    // Storage full or blocked — the game stays playable, it just won't persist.
  }
};

/**
 * True when a stored history value (e.g. a storage event's `newValue`) holds
 * no records: the history was cleared. Eviction by HISTORY_LIMIT never empties
 * it, so an empty history means the score was reset too.
 */
export const isEmptyHistoryValue = (raw: string | null): boolean => {
  if (raw === null) return true;
  try {
    return parseHistory(JSON.parse(raw) as unknown).length === 0;
  } catch {
    return true;
  }
};

export const loadSettings = (): Settings => parseSettings(read(KEYS.settings));

export const saveSettings = (settings: Settings): void => write(KEYS.settings, settings);

export const loadHistory = (): MatchRecord[] => parseHistory(read(KEYS.history));

export const saveHistory = (history: MatchRecord[]): void =>
  write(KEYS.history, history.slice(0, HISTORY_LIMIT));

export const loadScoreboard = (): Scoreboard => parseScoreboard(read(KEYS.scoreboard));

export const saveScoreboard = (scoreboard: Scoreboard): void => write(KEYS.scoreboard, scoreboard);
