// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
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

  it.each([null, 42, 'record', [], undefined])('rejects %o', (raw) => {
    expect(parseRecord(raw)).toBeNull();
  });

  it('upgrades records written before player names were stored', () => {
    const legacy: Record<string, unknown> = { ...validRecord() };
    delete legacy.players;
    expect(parseRecord(legacy)?.players).toEqual({ X: 'X', O: 'O' });
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
    const history = parseHistory([validRecord({ result: 'O' }), validRecord({ result: 'X' })]);
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
