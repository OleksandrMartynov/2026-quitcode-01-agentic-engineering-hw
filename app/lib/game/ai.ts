import { applyMove, isPlayable } from './engine';
import { otherPlayer } from './rules';
import { MODES } from './types';
import type { GameState, Player } from './types';

const EMPTY = 0;

/** How much an open line is worth per mark already in it: 1, 10, 100, 1000... */
const lineWeight = (marks: number): number => 10 ** (marks - 1);

const WIN_SCORE = 100_000;

const emptyCells = (state: GameState): number[] => {
  const cells: number[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === null) cells.push(i);
  }
  return cells;
};

/** Cells ordered from the middle outwards — good alpha-beta move ordering. */
const centerFirst = (cells: number[], size: number): number[] => {
  const middle = (size - 1) / 2;
  const distance = (index: number) =>
    Math.abs(Math.floor(index / size) - middle) + Math.abs((index % size) - middle);
  return [...cells].sort((a, b) => distance(a) - distance(b));
};

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

/**
 * Fast mutable mirror of the engine used only inside the search: the same
 * place-then-vanish-then-check order as `applyMove`, but with do/undo on a
 * typed array instead of cloning a GameState for every node.
 */
type Search = {
  board: Int8Array;
  queues: [number[], number[]];
  linesByCell: number[][];
  lines: number[][];
  maxMarks: number;
  size: number;
};

const code = (player: Player): 1 | 2 => (player === 'X' ? 1 : 2);

const createSearch = (state: GameState): Search => {
  const board = new Int8Array(state.board.length);
  state.board.forEach((cell, index) => {
    board[index] = cell === null ? EMPTY : code(cell);
  });

  const linesByCell: number[][] = Array.from({ length: board.length }, () => []);
  state.lines.forEach((line, lineIndex) => {
    for (const cell of line) linesByCell[cell].push(lineIndex);
  });

  return {
    board,
    queues: [[...state.queues.X], [...state.queues.O]],
    linesByCell,
    lines: state.lines,
    maxMarks: MODES[state.settings.mode].maxMarks,
    size: state.settings.size,
  };
};

const doMove = (search: Search, cell: number, player: 1 | 2): number => {
  search.board[cell] = player;
  const queue = search.queues[player - 1];
  queue.push(cell);
  if (queue.length > search.maxMarks) {
    const removed = queue.shift() as number;
    search.board[removed] = EMPTY;
    return removed;
  }
  return -1;
};

const undoMove = (search: Search, cell: number, player: 1 | 2, removed: number): void => {
  const queue = search.queues[player - 1];
  if (removed >= 0) {
    search.board[removed] = player;
    queue.unshift(removed);
  }
  queue.pop();
  search.board[cell] = EMPTY;
};

/** Only lines through the played cell can have been completed by that move. */
const wonAt = (search: Search, cell: number, player: 1 | 2): boolean =>
  search.linesByCell[cell].some((lineIndex) =>
    search.lines[lineIndex].every((index) => search.board[index] === player)
  );

const isFull = (search: Search): boolean => !search.board.includes(EMPTY);

/** Static evaluation from the maximizing player's point of view. */
const evaluate = (search: Search, me: 1 | 2): number => {
  const rival = me === 1 ? 2 : 1;
  let score = 0;

  for (const line of search.lines) {
    let mine = 0;
    let theirs = 0;
    for (const index of line) {
      const value = search.board[index];
      if (value === me) mine++;
      else if (value === rival) theirs++;
    }
    if (mine > 0 && theirs === 0) score += lineWeight(mine);
    else if (theirs > 0 && mine === 0) score -= lineWeight(theirs);
  }

  return score;
};

const minimax = (
  search: Search,
  me: 1 | 2,
  turn: 1 | 2,
  depth: number,
  ply: number,
  alpha: number,
  beta: number
): number => {
  if (depth === 0) return evaluate(search, me);

  const candidates: number[] = [];
  for (let i = 0; i < search.board.length; i++) {
    if (search.board[i] === EMPTY) candidates.push(i);
  }
  if (candidates.length === 0) return 0;

  const ordered = centerFirst(candidates, search.size);
  const maximizing = turn === me;
  let best = maximizing ? -Infinity : Infinity;
  let localAlpha = alpha;
  let localBeta = beta;

  for (const cell of ordered) {
    const removed = doMove(search, cell, turn);
    let score: number;

    if (wonAt(search, cell, turn)) {
      // Prefer winning sooner and losing later.
      score = maximizing ? WIN_SCORE - ply : -WIN_SCORE + ply;
    } else if (isFull(search)) {
      score = 0;
    } else {
      score = minimax(search, me, turn === 1 ? 2 : 1, depth - 1, ply + 1, localAlpha, localBeta);
    }

    undoMove(search, cell, turn, removed);

    if (maximizing) {
      if (score > best) best = score;
      if (best > localAlpha) localAlpha = best;
    } else {
      if (score < best) best = score;
      if (best < localBeta) localBeta = best;
    }
    if (localBeta <= localAlpha) break;
  }

  return best;
};

const chooseHard = (state: GameState): number => {
  const cells = emptyCells(state);
  const search = createSearch(state);
  const me = code(state.current);
  const rival = me === 1 ? 2 : 1;
  const depth = MODES[state.settings.mode].searchDepth(cells.length);

  let bestScore = -Infinity;
  let bestCells: number[] = [];

  for (const cell of centerFirst(cells, state.settings.size)) {
    const removed = doMove(search, cell, me);
    let score: number;

    if (wonAt(search, cell, me)) score = WIN_SCORE;
    else if (isFull(search)) score = 0;
    else score = minimax(search, me, rival, depth - 1, 1, -Infinity, Infinity);

    undoMove(search, cell, me, removed);

    if (score > bestScore) {
      bestScore = score;
      bestCells = [cell];
    } else if (score === bestScore) {
      bestCells.push(cell);
    }
  }

  return pickRandom(bestCells);
};

/** Wins if it can, blocks if it must, otherwise plays a sensible cell. */
const chooseMedium = (state: GameState): number => {
  const cells = emptyCells(state);
  const me = state.current;
  const rival = otherPlayer(me);

  const winning = cells.find((cell) => {
    const next = applyMove(state, cell);
    return next.outcome.type === 'win' && next.outcome.winner === me;
  });
  if (winning !== undefined) return winning;

  const rivalTurn: GameState = { ...state, current: rival };
  const blocking = cells.find((cell) => {
    const next = applyMove(rivalTurn, cell);
    return next.outcome.type === 'win' && next.outcome.winner === rival;
  });
  if (blocking !== undefined) return blocking;

  const { size } = state.settings;
  if (size % 2 === 1) {
    const center = Math.floor((size * size) / 2);
    if (state.board[center] === null) return center;
  }

  const corners = [0, size - 1, size * (size - 1), size * size - 1].filter(
    (cell) => state.board[cell] === null
  );
  if (corners.length > 0) return pickRandom(corners);

  return pickRandom(cells);
};

/**
 * Picks a move for the player currently on turn. Pure and synchronous: the
 * depth caps in MODES keep every difficulty well inside a single frame.
 */
export const chooseMove = (state: GameState): number => {
  const cells = emptyCells(state);
  if (state.outcome.type !== 'playing' || cells.length === 0) return -1;

  switch (state.settings.difficulty) {
    case 'easy':
      return pickRandom(cells);
    case 'medium':
      return chooseMedium(state);
    case 'hard':
      return chooseHard(state);
  }
};

export const canMove = (state: GameState, index: number): boolean => isPlayable(state, index);
