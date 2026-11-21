// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './game/types';
import type { Settings } from './game/types';
import { useGame } from './useGame';

/*
 * The hook is where storage, timers and the engine meet, and where both
 * serious defects from the code review lived. These tests drive it the way
 * the UI does — through its public callbacks — and read localStorage back.
 */

const twoPlayers: Settings = { ...DEFAULT_SETTINGS, opponent: 'human' };
const stored = (key: string): unknown => JSON.parse(window.localStorage.getItem(`ttt-lab:${key}`) ?? 'null');

const mount = () => renderHook(() => useGame());

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

describe('useGame with a corrupted localStorage', () => {
  it('mounts, drops the bad entries and heals what is stored', () => {
    window.localStorage.setItem('ttt-lab:settings', JSON.stringify({ mode: 'chess', size: 'big' }));
    window.localStorage.setItem(
      'ttt-lab:history',
      JSON.stringify([{ id: 'broken' }, { mode: undefined }, 'garbage'])
    );
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: '3' }));

    const { result } = mount();

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.current.history).toEqual([]);
    expect(result.current.scoreboard).toEqual({ X: 0, O: 0, draws: 0 });
    expect(stored('history')).toEqual([]);
    expect(stored('scoreboard')).toEqual({ X: 0, O: 0, draws: 0 });
  });

  it('keeps counting with numbers after a string count was stored', () => {
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: '3', O: 1 }));
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));

    expect(result.current.scoreboard).toEqual({ X: 1, O: 1, draws: 0 });
  });
});

describe('time travel and the match history', () => {
  it('records a replayed game once, with its latest result', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    // X wins on the top row.
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));
    expect(result.current.history).toHaveLength(1);

    // Rewind to before the winning move several times and win again each time.
    for (let i = 0; i < 5; i++) {
      act(() => result.current.rewind(4));
      act(() => result.current.play(2));
    }
    expect(result.current.history).toHaveLength(1);
    expect(result.current.scoreboard).toEqual({ X: 1, O: 0, draws: 0 });

    // Rewind further and let O win instead: the record flips, the total stays 1.
    act(() => result.current.rewind(4));
    act(() => result.current.play(8));
    act(() => result.current.play(5));
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].result).toBe('O');
    expect(result.current.scoreboard).toEqual({ X: 0, O: 1, draws: 0 });
    expect(stored('scoreboard')).toEqual({ X: 0, O: 1, draws: 0 });
  });

  it('counts different games separately', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));
    act(() => result.current.restart());
    for (const cell of [0, 1, 2, 4, 3, 5, 7, 6, 8]) act(() => result.current.play(cell));

    expect(result.current.history.map((record) => record.result)).toEqual(['draw', 'X']);
    expect(result.current.scoreboard).toEqual({ X: 1, O: 0, draws: 1 });
  });

  it('clears history and score, in memory and in storage', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));
    act(() => result.current.clearHistory());

    expect(result.current.history).toEqual([]);
    expect(stored('history')).toEqual([]);
    expect(stored('scoreboard')).toEqual({ X: 0, O: 0, draws: 0 });
  });
});

describe('timers', () => {
  it('lets the computer answer after its thinking delay', () => {
    const { result } = mount();
    act(() => result.current.startGame({ ...DEFAULT_SETTINGS, opponent: 'ai', difficulty: 'hard' }));
    act(() => result.current.play(0));
    expect(result.current.aiTurn).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.game.moves).toHaveLength(2);
    expect(result.current.game.moves[1].player).toBe('O');
    expect(result.current.aiTurn).toBe(false);
  });

  it('does not let a pending AI reply land on a rewound position', () => {
    const { result } = mount();
    act(() => result.current.startGame({ ...DEFAULT_SETTINGS, opponent: 'ai' }));
    act(() => result.current.play(0));
    act(() => result.current.rewind(0));
    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.game.moves).toEqual([]);
  });

  it('ends a blitz game on time and records it once', () => {
    const { result } = mount();
    act(() => result.current.startGame({ ...twoPlayers, mode: 'blitz', turnSeconds: 5 }));
    act(() => result.current.play(4));
    expect(result.current.secondsLeft).toBe(5);

    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.secondsLeft).toBe(3);

    act(() => vi.advanceTimersByTime(3_500));
    expect(result.current.game.outcome).toEqual({ type: 'timeout', winner: 'X' });
    expect(result.current.secondsLeft).toBeNull();
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].reason).toBe('timeout');
  });
});

describe('settings', () => {
  it('trims empty names back to defaults and persists the started settings', () => {
    const { result } = mount();
    act(() => result.current.startGame({ ...twoPlayers, playerXName: '   ', playerOName: ' Bob ' }));

    expect(result.current.settings.playerXName).toBe(DEFAULT_SETTINGS.playerXName);
    expect(result.current.settings.playerOName).toBe('Bob');
    expect(stored('settings')).toMatchObject({ playerOName: 'Bob', opponent: 'human' });
  });
});
