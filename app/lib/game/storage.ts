import { DEFAULT_SETTINGS, normalizeSettings } from './types';
import type { MatchRecord, Scoreboard, Settings } from './types';

const KEYS = {
  settings: 'ttt-lab:settings',
  history: 'ttt-lab:history',
  scoreboard: 'ttt-lab:scoreboard',
} as const;

export const EMPTY_SCOREBOARD: Scoreboard = { X: 0, O: 0, draws: 0 };

/** Keeps the stored history from growing without bound. */
export const HISTORY_LIMIT = 25;

/**
 * localStorage is unavailable during SSR and can throw in private browsing, so
 * every read falls back to a sane default instead of taking the app down.
 */
const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
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

export const loadSettings = (): Settings =>
  normalizeSettings({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) });

export const saveSettings = (settings: Settings): void => write(KEYS.settings, settings);

export const loadHistory = (): MatchRecord[] => {
  const history = read<MatchRecord[]>(KEYS.history, []);
  return Array.isArray(history) ? history.slice(0, HISTORY_LIMIT) : [];
};

export const saveHistory = (history: MatchRecord[]): void =>
  write(KEYS.history, history.slice(0, HISTORY_LIMIT));

export const loadScoreboard = (): Scoreboard => ({
  ...EMPTY_SCOREBOARD,
  ...read<Partial<Scoreboard>>(KEYS.scoreboard, {}),
});

export const saveScoreboard = (scoreboard: Scoreboard): void => write(KEYS.scoreboard, scoreboard);

export const clearStoredMatches = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEYS.history);
    window.localStorage.removeItem(KEYS.scoreboard);
  } catch {
    // Nothing to do — the in-memory state is cleared by the caller anyway.
  }
};
