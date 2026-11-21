import {
  DEFAULT_SETTINGS,
  DIFFICULTY_LEVELS,
  GAME_MODES,
  MODES,
  OPPONENTS,
  cleanName,
  normalizeSettings,
} from './types';
import type { MatchRecord, Player, Scoreboard, Settings } from './types';

const KEYS = {
  settings: 'ttt-lab:settings',
  history: 'ttt-lab:history',
  scoreboard: 'ttt-lab:scoreboard',
} as const;

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

  return {
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
  };
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
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — the game stays playable, it just won't persist.
  }
};

export const loadSettings = (): Settings => parseSettings(read(KEYS.settings));

export const saveSettings = (settings: Settings): void => write(KEYS.settings, settings);

export const loadHistory = (): MatchRecord[] => parseHistory(read(KEYS.history));

export const saveHistory = (history: MatchRecord[]): void =>
  write(KEYS.history, history.slice(0, HISTORY_LIMIT));

export const loadScoreboard = (): Scoreboard => parseScoreboard(read(KEYS.scoreboard));

export const saveScoreboard = (scoreboard: Scoreboard): void => write(KEYS.scoreboard, scoreboard);
