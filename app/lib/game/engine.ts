import { buildLines, findWinner, isBoardFull, otherPlayer } from './rules';
import { AI, MODES, normalizeSettings } from './types';
import type { GameState, Move, Player, Settings } from './types';

const makeId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createGame = (rawSettings: Settings): GameState => {
  const settings = normalizeSettings(rawSettings);
  return {
    id: makeId(),
    settings,
    board: Array<null>(settings.size * settings.size).fill(null),
    current: 'X',
    moves: [],
    queues: { X: [], O: [] },
    outcome: { type: 'playing' },
    lines: buildLines(settings.size, settings.winLength),
    startedAt: Date.now(),
    turnStartedAt: Date.now(),
    assists: { rewound: false, hinted: false },
  };
};

export const isPlayable = (state: GameState, index: number): boolean =>
  state.outcome.type === 'playing' && state.board[index] === null;

/**
 * The source of truth for a move: the UI, the medium AI, hints and replays all
 * go through it. The hard AI uses a faster mirror of these rules in
 * `search.ts`, which `search.test.ts` keeps in agreement with this function.
 */
export const applyMove = (state: GameState, index: number): GameState => {
  if (!isPlayable(state, index)) return state;

  const player = state.current;
  const board = [...state.board];
  const queue = [...state.queues[player]];

  board[index] = player;
  queue.push(index);

  // Vanishing rule: placing beyond the mark limit frees the oldest mark. This
  // happens BEFORE the win check, so a vanishing mark cannot complete a line.
  let removed: number | null = null;
  const { maxMarks } = MODES[state.settings.mode];
  if (queue.length > maxMarks) {
    removed = queue.shift() ?? null;
    if (removed !== null) board[removed] = null;
  }

  const move: Move = { index, player, removed };
  const moves = [...state.moves, move];
  const queues = { ...state.queues, [player]: queue };

  const win = findWinner(board, state.lines);
  const outcome: GameState['outcome'] = win
    ? { type: 'win', winner: win.winner, line: win.line }
    : isBoardFull(board)
      ? { type: 'draw' }
      : { type: 'playing' };

  return {
    ...state,
    board,
    queues,
    moves,
    outcome,
    current: outcome.type === 'playing' ? otherPlayer(player) : player,
    turnStartedAt: Date.now(),
  };
};

/**
 * True when the player on the blitz clock has used up their time. The clock
 * runs from the first move on, and never on the computer's turn. Moves and
 * clock ticks both ask this, so a click that lands after the deadline — but
 * before the next tick, e.g. in a throttled background tab — loses on time
 * instead of being played.
 */
export const isOutOfTime = (state: GameState, now: number): boolean => {
  if (!MODES[state.settings.mode].timed || state.outcome.type !== 'playing') return false;
  if (state.moves.length === 0) return false;
  if (state.settings.opponent === 'ai' && state.current === AI) return false;
  return now >= state.turnStartedAt + state.settings.turnSeconds * 1000;
};

/** The player on the clock ran out of time and loses the game. */
export const applyTimeout = (state: GameState): GameState => {
  if (state.outcome.type !== 'playing') return state;
  return { ...state, outcome: { type: 'timeout', winner: otherPlayer(state.current) } };
};

/**
 * Replays the first `moveCount` moves into a fresh game — used for time
 * travel. The game keeps its identity and is marked as rewound, so its result
 * is not counted as unassisted play.
 */
export const rewindTo = (state: GameState, moveCount: number): GameState =>
  state.moves.slice(0, moveCount).reduce<GameState>((game, move) => applyMove(game, move.index), {
    ...createGame(state.settings),
    id: state.id,
    startedAt: state.startedAt,
    assists: { ...state.assists, rewound: true },
  });

/** Marks that a hint was shown in this game. */
export const markHinted = (state: GameState): GameState =>
  state.assists.hinted ? state : { ...state, assists: { ...state.assists, hinted: true } };

/**
 * Marks that will vanish on their owner's next move, for the board hint. A
 * finished game has no next move, so nothing is doomed — otherwise a mark on
 * the winning line would be drawn faded.
 */
export const doomedMarks = (state: GameState): number[] => {
  const { maxMarks } = MODES[state.settings.mode];
  if (!Number.isFinite(maxMarks) || state.outcome.type !== 'playing') return [];
  return (['X', 'O'] as Player[])
    .filter((player) => state.queues[player].length === maxMarks)
    .map((player) => state.queues[player][0]);
};
