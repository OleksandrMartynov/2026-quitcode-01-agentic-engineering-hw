export type Player = 'X' | 'O';
export type Cell = Player | null;
export type Board = Cell[];

/*
 * The literal unions are derived from runtime arrays so that the storage layer
 * can validate untrusted input against exactly the same set of values.
 */
export const GAME_MODES = ['classic', 'vanishing', 'grand', 'blitz'] as const;
export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;
export const OPPONENTS = ['ai', 'human'] as const;

export type GameMode = (typeof GAME_MODES)[number];
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];
export type Opponent = (typeof OPPONENTS)[number];

/** The human always plays X; the AI opponent always plays O. */
export const HUMAN: Player = 'X';
export const AI: Player = 'O';

export type Settings = {
  mode: GameMode;
  /** Board edge length: the board holds size * size cells. */
  size: number;
  /** Marks in a row needed to win. */
  winLength: number;
  opponent: Opponent;
  difficulty: Difficulty;
  /** Seconds per move, used by the blitz mode only. */
  turnSeconds: number;
  playerXName: string;
  playerOName: string;
};

export type Outcome =
  | { type: 'playing' }
  /** `line`: every cell of every line the winning move completed. */
  | { type: 'win'; winner: Player; line: number[] }
  | { type: 'draw' }
  /** The player whose clock ran out loses; `winner` is the other one. */
  | { type: 'timeout'; winner: Player };

export type Move = {
  index: number;
  player: Player;
  /** Cell freed by the vanishing rule when this mark was placed, if any. */
  removed: number | null;
};

export type GameState = {
  id: string;
  settings: Settings;
  board: Board;
  current: Player;
  moves: Move[];
  /** Cells owned by each player in placement order — drives the vanishing rule. */
  queues: Record<Player, number[]>;
  outcome: Outcome;
  /** Wall-clock start of the turn on the board, used by the blitz clock. */
  turnStartedAt: number;
  /** Every winning line for this board geometry, precomputed once per game. */
  lines: number[][];
  startedAt: number;
};

export type MatchRecord = {
  id: string;
  playedAt: string;
  mode: GameMode;
  opponent: Opponent;
  difficulty: Difficulty | null;
  size: number;
  winLength: number;
  /** Player names as they were when the game was played. */
  players: Record<Player, string>;
  result: Player | 'draw';
  reason: 'line' | 'draw' | 'timeout';
  moveCount: number;
  durationMs: number;
  /**
   * Cells played, in order — enough to rebuild every position for the replay.
   * Null for records written before moves were stored, and for very long
   * Vanishing games (see MAX_STORED_MOVES).
   */
  moves: number[] | null;
};

export type Scoreboard = { X: number; O: number; draws: number };

export type ModeConfig = {
  label: string;
  tagline: string;
  /** Board sizes the mode allows; the first one is its default. */
  sizes: number[];
  /** Win lengths allowed per board size. */
  winLengths: (size: number) => number[];
  /** Each player keeps at most this many marks on the board (Infinity = classic). */
  maxMarks: number;
  timed: boolean;
  /** How deep the hard AI is allowed to search in this mode. */
  searchDepth: (emptyCells: number) => number;
  /**
   * True when `searchDepth` always reaches the end of the game, i.e. the hard
   * AI plays perfectly. Drives the difficulty label, so the UI never promises a
   * full search where the depth is capped.
   */
  exhaustiveSearch: boolean;
};

export const MODES: Record<GameMode, ModeConfig> = {
  classic: {
    label: 'Classic',
    tagline: '3x3, three in a row. The game everyone already knows.',
    sizes: [3],
    winLengths: () => [3],
    maxMarks: Number.POSITIVE_INFINITY,
    timed: false,
    // 3x3 is small enough to search exhaustively, which makes hard unbeatable.
    searchDepth: (emptyCells) => emptyCells,
    exhaustiveSearch: true,
  },
  vanishing: {
    label: 'Vanishing',
    tagline: 'Only three marks each. Placing a fourth removes your oldest one.',
    sizes: [3],
    winLengths: () => [3],
    maxMarks: 3,
    timed: false,
    // The board never fills up, so the tree is infinite without a cap.
    searchDepth: () => 6,
    exhaustiveSearch: false,
  },
  grand: {
    label: 'Grand',
    tagline: 'A bigger board: pick 4x4 or 5x5 and how long a line must be.',
    sizes: [4, 5],
    winLengths: (size) => (size === 4 ? [4] : [4, 5]),
    maxMarks: Number.POSITIVE_INFINITY,
    timed: false,
    searchDepth: (emptyCells) => (emptyCells > 16 ? 4 : 5),
    exhaustiveSearch: false,
  },
  blitz: {
    label: 'Blitz',
    tagline: '3x3 against the clock. Run out of time and you lose the game.',
    sizes: [3],
    winLengths: () => [3],
    maxMarks: Number.POSITIVE_INFINITY,
    timed: true,
    searchDepth: (emptyCells) => emptyCells,
    exhaustiveSearch: true,
  },
};

export const TURN_SECONDS_OPTIONS = [5, 10, 20] as const;

export const NAME_MAX_LENGTH = 16;

export const DEFAULT_SETTINGS: Settings = {
  mode: 'classic',
  size: 3,
  winLength: 3,
  opponent: 'ai',
  difficulty: 'medium',
  turnSeconds: 10,
  playerXName: 'You',
  playerOName: 'Rival',
};

/**
 * Clamps every bounded field to what the chosen mode allows. Safe to call on
 * each keystroke: it never touches the free-text player names.
 */
export const normalizeSettings = (settings: Settings): Settings => {
  const mode = (GAME_MODES as readonly string[]).includes(settings.mode)
    ? settings.mode
    : DEFAULT_SETTINGS.mode;
  const config = MODES[mode];
  const size = config.sizes.includes(settings.size) ? settings.size : config.sizes[0];
  const winLengths = config.winLengths(size);
  const winLength = winLengths.includes(settings.winLength) ? settings.winLength : winLengths[0];
  const turnSeconds = (TURN_SECONDS_OPTIONS as readonly number[]).includes(settings.turnSeconds)
    ? settings.turnSeconds
    : DEFAULT_SETTINGS.turnSeconds;
  const opponent = (OPPONENTS as readonly string[]).includes(settings.opponent)
    ? settings.opponent
    : DEFAULT_SETTINGS.opponent;
  const difficulty = (DIFFICULTY_LEVELS as readonly string[]).includes(settings.difficulty)
    ? settings.difficulty
    : DEFAULT_SETTINGS.difficulty;
  return { ...settings, mode, size, winLength, turnSeconds, opponent, difficulty };
};

/** Trims a player name and falls back when it ends up empty or is not a string. */
export const cleanName = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, NAME_MAX_LENGTH).trim();
  return trimmed === '' ? fallback : trimmed;
};

/** Full clean-up for settings that are about to start a game. */
export const finalizeSettings = (settings: Settings): Settings => {
  const normalized = normalizeSettings(settings);
  return {
    ...normalized,
    playerXName: cleanName(normalized.playerXName, DEFAULT_SETTINGS.playerXName),
    playerOName: cleanName(normalized.playerOName, DEFAULT_SETTINGS.playerOName),
  };
};
