// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  announceClear,
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
