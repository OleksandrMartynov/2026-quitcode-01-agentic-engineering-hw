// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HISTORY_LIMIT,
  announceClear,
  loadStats,
  updateStoredStats,
  loadHistory,
  loadScoreboard,
  loadSettings,
  parseHistory,
  parseRecord,
  parseScoreboard,
  parseSettings,
} from './storage';
import { DEFAULT_SETTINGS } from './types';
import type { MatchRecord } from './types';
import type { StoredStats } from './storage';

const validRecord = (patch: Partial<MatchRecord> = {}): MatchRecord => ({
  id: 'game-1',
  playedAt: '2026-09-06T10:00:00.000Z',
  mode: 'classic',
  opponent: 'ai',
  difficulty: 'hard',
  size: 3,
  winLength: 3,
  players: { X: 'You', O: 'Rival' },
  result: 'X',
  reason: 'line',
  moveCount: 7,
  durationMs: 12_000,
  // X: 0, 1, 6, 2 / O: 3, 4, 8 — X completes the top row on move 7.
  moves: [0, 3, 1, 4, 6, 8, 2],
  rewound: false,
  hinted: false,
  ...patch,
});

beforeEach(() => window.localStorage.clear());

describe('parseRecord', () => {
  it('accepts a complete record unchanged', () => {
    expect(parseRecord(validRecord())).toEqual(validRecord());
  });

  // Each of these used to reach `MODES[record.mode].label` and blank the page.
  it.each([
    ['unknown mode', { mode: 'chess' }],
    ['missing mode', { mode: undefined }],
    ['size not allowed by the mode', { size: 4 }],
    ['win length not allowed by the size', { mode: 'grand', size: 4, winLength: 5 }],
    ['unknown result', { result: 'Z' }],
    ['draw with a winner reason', { result: 'draw', reason: 'line' }],
    ['winner with a draw reason', { result: 'X', reason: 'draw' }],
    ['string move count', { moveCount: '7' }],
    ['negative duration', { durationMs: -5 }],
    ['unparseable date', { playedAt: 'yesterday' }],
    ['empty id', { id: '' }],
    ['ai game without difficulty', { difficulty: null }],
  ])('rejects a record with %s', (_label, patch) => {
    expect(parseRecord({ ...validRecord(), ...patch })).toBeNull();
  });

  // Records without moves can still be impossible games.
  it.each([
    ['a timeout in an untimed mode', { mode: 'classic', reason: 'timeout', result: 'X', moveCount: 1 }],
    ['a draw in Vanishing', { mode: 'vanishing', reason: 'draw', result: 'draw', moveCount: 9 }],
    ['a draw on a board that is not full', { reason: 'draw', result: 'draw', moveCount: 7 }],
    ['a win with no moves', { moveCount: 0 }],
    ['a win faster than a line can be built', { moveCount: 3 }],
    ['more moves than cells', { moveCount: 9999 }],
    ['a winner who did not make the last move', { result: 'O', moveCount: 7 }],
    ['a timeout lost by the player who just moved', { mode: 'blitz', reason: 'timeout', result: 'O', moveCount: 1 }],
    ['a timeout before any move', { mode: 'blitz', reason: 'timeout', result: 'O', moveCount: 0 }],
  ])('rejects a record without moves showing %s', (_label, patch) => {
    expect(parseRecord({ ...validRecord(), moves: null, ...patch })).toBeNull();
  });

  it.each([null, 42, 'record', [], undefined])('rejects %o', (raw) => {
    expect(parseRecord(raw)).toBeNull();
  });

  it('upgrades records written before player names were stored', () => {
    const legacy: Record<string, unknown> = { ...validRecord() };
    delete legacy.players;
    expect(parseRecord(legacy)?.players).toEqual({ X: 'X', O: 'O' });
  });

  it('keeps a legacy record without moves, just without a replay', () => {
    const legacy: Record<string, unknown> = { ...validRecord() };
    delete legacy.moves;
    expect(parseRecord(legacy)?.moves).toBeNull();
  });

  // The move list is checked by replaying it through the engine.
  it.each([
    ['an occupied cell', { moves: [0, 0, 1, 4, 6, 8, 2] }],
    ['an off-board cell', { moves: [0, 3, 1, 4, 6, 8, 9] }],
    ['a move after the game ended', { moves: [0, 3, 1, 4, 2, 8, 5] }],
    ['no winner at the end', { moves: [0, 1, 2, 4, 3, 5, 7] }],
    ['the other player winning', { moves: [3, 0, 4, 1, 8, 2], moveCount: 6 }],
    ['a count that differs from the list', { moves: [0, 3, 1, 4, 2] }],
    ['non-integer cells', { moves: [0, 3, 1, 4, 6, 8, 2.5] }],
  ])('rejects a record whose moves show %s', (_label, patch) => {
    expect(parseRecord({ ...validRecord(), ...patch })).toBeNull();
  });

  it('accepts the same lists once they match the record', () => {
    expect(parseRecord(validRecord({ moves: [3, 0, 4, 1, 8, 2], moveCount: 6, result: 'O' }))).not.toBeNull();
    expect(parseRecord(validRecord({ moves: [0, 3, 1, 4, 2], moveCount: 5 }))).not.toBeNull();
  });

  it('rejects a move list that is not an array', () => {
    expect(parseRecord({ ...validRecord(), moves: '0,3,1' })).toBeNull();
  });

  it('accepts a timeout only if the loser was the player on turn', () => {
    const timeout = validRecord({ result: 'X', reason: 'timeout', mode: 'blitz', moveCount: 1, moves: [4] });
    expect(parseRecord(timeout)).toEqual(timeout);
    expect(parseRecord({ ...timeout, result: 'O' })).toBeNull();
  });

  it('accepts a real draw and a vanishing win', () => {
    const draw = validRecord({ result: 'draw', reason: 'draw', moveCount: 9, moves: [0, 1, 2, 4, 3, 5, 7, 6, 8] });
    expect(parseRecord(draw)).toEqual(draw);
    // X's marks at 0 and 1 vanish on moves 7 and 9; X still completes 2-5-8.
    const vanishing = validRecord({ mode: 'vanishing', moveCount: 9, moves: [0, 3, 1, 4, 8, 6, 5, 7, 2] });
    expect(parseRecord(vanishing)).toEqual(vanishing);
  });

  it('reads legacy records without assist flags as unassisted, and keeps real flags', () => {
    const legacy: Record<string, unknown> = { ...validRecord() };
    delete legacy.rewound;
    delete legacy.hinted;
    expect(parseRecord(legacy)).toMatchObject({ rewound: false, hinted: false });
    expect(parseRecord({ ...validRecord(), rewound: true, hinted: 'yes' })).toMatchObject({
      rewound: true,
      hinted: false,
    });
  });

  it('drops a stray difficulty on a two-player game', () => {
    expect(parseRecord(validRecord({ opponent: 'human', difficulty: 'hard' }))?.difficulty).toBeNull();
  });
});

describe('parseHistory', () => {
  it('keeps the valid records and drops the rest', () => {
    const history = parseHistory([validRecord(), { mode: 'chess' }, null, validRecord({ id: 'game-2' })]);
    expect(history.map((record) => record.id)).toEqual(['game-1', 'game-2']);
  });

  it('keeps only the newest copy of a duplicated id', () => {
    const history = parseHistory([validRecord({ result: 'O', moveCount: 6, moves: null }), validRecord()]);
    expect(history).toHaveLength(1);
    expect(history[0].result).toBe('O');
  });

  it('caps the history length', () => {
    const many = Array.from({ length: HISTORY_LIMIT + 10 }, (_, i) => validRecord({ id: `g${i}` }));
    expect(parseHistory(many)).toHaveLength(HISTORY_LIMIT);
  });

  it.each([null, {}, 'nope', 3])('treats %o as an empty history', (raw) => {
    expect(parseHistory(raw)).toEqual([]);
  });
});

describe('parseScoreboard', () => {
  it('does not let a string count turn the score into string concatenation', () => {
    // {"X":"3"} used to survive, and `previous.X + 1` then produced "31".
    const board = parseScoreboard({ X: '3', O: 2, draws: 1 });
    expect(board).toEqual({ X: 0, O: 2, draws: 1 });
    expect(board.X + 1).toBe(1);
  });

  it.each([
    [{ X: -1, O: 1.5, draws: Number.NaN }, { X: 0, O: 0, draws: 0 }],
    [null, { X: 0, O: 0, draws: 0 }],
    [[1, 2, 3], { X: 0, O: 0, draws: 0 }],
  ])('sanitizes %o', (raw, expected) => {
    expect(parseScoreboard(raw)).toEqual(expected);
  });
});

describe('parseSettings', () => {
  it('returns the defaults for garbage', () => {
    expect(parseSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('replaces each invalid field on its own and keeps the valid ones', () => {
    const settings = parseSettings({
      mode: 'grand',
      size: 5,
      winLength: 5,
      opponent: 'robot',
      difficulty: 'insane',
      turnSeconds: 'soon',
      playerXName: '   ',
      playerOName: 'A very long name that does not fit',
    });
    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      mode: 'grand',
      size: 5,
      winLength: 5,
      playerOName: 'A very long name',
    });
  });

  it('clamps a stored size that the mode does not allow', () => {
    expect(parseSettings({ mode: 'classic', size: 5, winLength: 5 })).toMatchObject({
      size: 3,
      winLength: 3,
    });
  });
});

describe('updateStoredStats', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('applies the change to what is in storage now, stores and reports it', () => {
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: 2, O: 0, draws: 0 }));
    const done = vi.fn();
    updateStoredStats(
      (current) => ({ ...current, scoreboard: { ...current.scoreboard, O: current.scoreboard.O + 1 } }),
      done
    );
    expect(loadScoreboard()).toEqual({ X: 2, O: 1, draws: 0 });
    expect(done).toHaveBeenCalledWith({ history: [], scoreboard: { X: 2, O: 1, draws: 0 } }, true);
  });

  it('reports a failed write and re-applies pending changes to fresh storage', () => {
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: 3, O: 0, draws: 0 }));
    const bumpX = (current: StoredStats): StoredStats => ({
      ...current,
      scoreboard: { ...current.scoreboard, X: current.scoreboard.X + 1 },
    });
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const done = vi.fn();
    try {
      // One earlier change is still pending, plus the new one.
      updateStoredStats(bumpX, done, () => [bumpX]);
    } finally {
      spy.mockRestore();
    }
    expect(done).toHaveBeenCalledWith({ history: [], scoreboard: { X: 5, O: 0, draws: 0 } }, false);
  });

  it('stores history and score in one write, so a failure leaves both untouched', () => {
    const before = JSON.stringify({ history: [], scoreboard: { X: 0, O: 0, draws: 0 } });
    window.localStorage.setItem('ttt-lab:stats', before);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const done = vi.fn();
    try {
      updateStoredStats(() => ({ history: [validRecord()], scoreboard: { X: 1, O: 0, draws: 0 } }), done);
    } finally {
      setItem.mockRestore();
    }
    expect(done).toHaveBeenCalledWith(expect.anything(), false);
    // There is no second key that could hold half of the change.
    expect(window.localStorage.getItem('ttt-lab:stats')).toBe(before);

    const writes = vi.spyOn(Storage.prototype, 'setItem');
    updateStoredStats(() => ({ history: [validRecord()], scoreboard: { X: 1, O: 0, draws: 0 } }), () => {});
    expect(writes.mock.calls.map(([key]) => key)).toEqual(['ttt-lab:stats']);
    writes.mockRestore();
  });

  it('migrates history and score from the two legacy keys on the first save', () => {
    window.localStorage.setItem('ttt-lab:history', JSON.stringify([validRecord()]));
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: 4, O: 2, draws: 1 }));
    expect(loadStats()).toEqual({ history: [validRecord()], scoreboard: { X: 4, O: 2, draws: 1 } });

    updateStoredStats((current) => current, () => {});
    expect(JSON.parse(window.localStorage.getItem('ttt-lab:stats')!)).toEqual({
      history: [validRecord()],
      scoreboard: { X: 4, O: 2, draws: 1 },
    });
    expect(window.localStorage.getItem('ttt-lab:history')).toBeNull();
    expect(window.localStorage.getItem('ttt-lab:scoreboard')).toBeNull();
  });

  it('runs every update under one Web Lock, one after the other', async () => {
    // A minimal Web Locks stand-in: requests for the same name run in order.
    let queue = Promise.resolve();
    const names: string[] = [];
    vi.stubGlobal('navigator', {
      locks: {
        request: (name: string, callback: () => void) => {
          names.push(name);
          queue = queue.then(callback);
          return queue;
        },
      },
    });
    const bump = (key: 'X' | 'O') =>
      updateStoredStats(
        (current) => ({ ...current, scoreboard: { ...current.scoreboard, [key]: current.scoreboard[key] + 1 } }),
        () => {}
      );

    // Two "tabs" ask at once; neither update may be lost.
    bump('X');
    bump('O');
    expect(loadScoreboard()).toEqual({ X: 0, O: 0, draws: 0 }); // queued, not yet run
    await queue;

    expect(names).toEqual(['ttt-lab:stats', 'ttt-lab:stats']);
    expect(loadScoreboard()).toEqual({ X: 1, O: 1, draws: 0 });
  });
});

describe('announceClear', () => {
  it('writes a new value on every clear, so each one fires a storage event', () => {
    announceClear();
    const first = window.localStorage.getItem('ttt-lab:cleared-at');
    announceClear();
    const second = window.localStorage.getItem('ttt-lab:cleared-at');
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });
});

describe('load* from a corrupted localStorage', () => {
  it('falls back to defaults on malformed JSON instead of throwing', () => {
    window.localStorage.setItem('ttt-lab:settings', '{not json');
    window.localStorage.setItem('ttt-lab:history', '[{');
    window.localStorage.setItem('ttt-lab:scoreboard', 'NaN');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadHistory()).toEqual([]);
    expect(loadScoreboard()).toEqual({ X: 0, O: 0, draws: 0 });
  });

  it('loads a mixed history without the broken entries', () => {
    window.localStorage.setItem('ttt-lab:history', JSON.stringify([{ id: 'x' }, validRecord()]));
    expect(loadHistory()).toEqual([validRecord()]);
  });
});
