export type Player = 'X' | 'O';
export type Cell = Player | null;
export type Board = Cell[];

export type GameMode = 'classic' | 'vanishing' | 'grand' | 'blitz';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Opponent = 'human' | 'ai';

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
  result: Player | 'draw';
  reason: 'line' | 'draw' | 'timeout';
  moveCount: number;
  durationMs: number;
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
  },
  grand: {
    label: 'Grand',
    tagline: 'A bigger board: pick 4x4 or 5x5 and how long a line must be.',
    sizes: [4, 5],
    winLengths: (size) => (size === 4 ? [4] : [4, 5]),
    maxMarks: Number.POSITIVE_INFINITY,
    timed: false,
    searchDepth: (emptyCells) => (emptyCells > 16 ? 3 : 4),
  },
  blitz: {
    label: 'Blitz',
    tagline: '3x3 against the clock. Run out of time and you lose the game.',
    sizes: [3],
    winLengths: () => [3],
    maxMarks: Number.POSITIVE_INFINITY,
    timed: true,
    searchDepth: (emptyCells) => emptyCells,
  },
};

export const TURN_SECONDS_OPTIONS = [5, 10, 20] as const;

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

/** Clamps size/winLength to what the chosen mode actually allows. */
export const normalizeSettings = (settings: Settings): Settings => {
  const config = MODES[settings.mode];
  const size = config.sizes.includes(settings.size) ? settings.size : config.sizes[0];
  const winLengths = config.winLengths(size);
  const winLength = winLengths.includes(settings.winLength) ? settings.winLength : winLengths[0];
  return { ...settings, size, winLength };
};
