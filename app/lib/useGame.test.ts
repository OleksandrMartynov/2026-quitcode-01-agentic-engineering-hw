// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
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

// Without vitest globals, Testing Library does not unmount on its own: hooks
// from earlier tests would stay mounted and keep reacting to storage events.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

describe('hints', () => {
  it('suggests the winning move and forgets it as soon as the position changes', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4]) act(() => result.current.play(cell));

    expect(result.current.hintCell).toBeNull();
    act(() => result.current.requestHint());
    expect(result.current.hintCell).toBe(2);

    act(() => result.current.play(8));
    expect(result.current.hintCell).toBeNull();
  });

  it('does not survive a rewind back to the same number of moves', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4]) act(() => result.current.play(cell));
    act(() => result.current.requestHint());
    act(() => result.current.rewind(2));
    for (const cell of [6, 7]) act(() => result.current.play(cell));

    expect(result.current.game.moves).toHaveLength(4);
    expect(result.current.hintCell).toBeNull();
  });

  it('is unavailable while the computer is thinking and after the game', () => {
    const { result } = mount();
    act(() => result.current.startGame({ ...DEFAULT_SETTINGS, opponent: 'ai' }));
    act(() => result.current.play(4));
    expect(result.current.canHint).toBe(false);
    act(() => result.current.requestHint());
    expect(result.current.hintCell).toBeNull();

    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));
    expect(result.current.canHint).toBe(false);
  });
});

describe('assists in the record', () => {
  it('marks a hinted game and a rewound game in the history', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4]) act(() => result.current.play(cell));
    act(() => result.current.requestHint());
    expect(result.current.hintCell).toBe(2);
    act(() => result.current.play(2));
    expect(result.current.history[0]).toMatchObject({ hinted: true, rewound: false });

    act(() => result.current.restart());
    for (const cell of [0, 3, 1, 4, 8]) act(() => result.current.play(cell));
    act(() => result.current.rewind(4));
    act(() => result.current.play(2));
    expect(result.current.history[0]).toMatchObject({ hinted: false, rewound: true });
  });
});

describe('stored moves', () => {
  it('stores a replayable move list that survives a reload', () => {
    const first = mount();
    act(() => first.result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => first.result.current.play(cell));
    first.unmount();

    const second = mount();
    expect(second.result.current.history).toHaveLength(1);
    expect(second.result.current.history[0].moves).toEqual([0, 3, 1, 4, 2]);
  });
});

describe('blitz', () => {
  const blitz: Settings = { ...twoPlayers, mode: 'blitz', turnSeconds: 5 };

  it('does not start the clock before the first move (no loss on page load)', () => {
    window.localStorage.setItem('ttt-lab:settings', JSON.stringify(blitz));
    const { result } = mount();
    expect(result.current.settings.mode).toBe('blitz');

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.game.outcome.type).toBe('playing');
    expect(result.current.secondsLeft).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.scoreboard).toEqual({ X: 0, O: 0, draws: 0 });
  });

  it('does not let a rewind reset the clock or undo a loss on time', () => {
    const { result } = mount();
    act(() => result.current.startGame(blitz));
    expect(result.current.rewindable).toBe(false);
    act(() => result.current.play(4));
    act(() => vi.advanceTimersByTime(4_000));

    act(() => result.current.rewind(0));
    expect(result.current.game.moves).toHaveLength(1);
    expect(result.current.secondsLeft).toBe(1);

    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.game.outcome).toEqual({ type: 'timeout', winner: 'X' });
    act(() => result.current.rewind(0));
    expect(result.current.game.outcome.type).toBe('timeout');
  });
});

describe('blitz deadline at the moment of the click', () => {
  it('loses on time instead of accepting a late move the ticker has not caught yet', () => {
    const { result } = mount();
    act(() => result.current.startGame({ ...twoPlayers, mode: 'blitz', turnSeconds: 5 }));
    for (const cell of [0, 3, 1, 4]) act(() => result.current.play(cell));

    // The clock ran out, but no interval tick has run since (e.g. a throttled
    // background tab): only the system time moves.
    vi.setSystemTime(Date.now() + 6_000);
    act(() => result.current.play(2));

    expect(result.current.game.outcome).toEqual({ type: 'timeout', winner: 'O' });
    expect(result.current.game.moves).toHaveLength(4);
  });

  it('still accepts the very first move whenever it comes', () => {
    const { result } = mount();
    act(() => result.current.startGame({ ...twoPlayers, mode: 'blitz', turnSeconds: 5 }));
    vi.setSystemTime(Date.now() + 60_000);
    act(() => result.current.play(4));
    expect(result.current.game.moves).toHaveLength(1);
    expect(result.current.game.outcome.type).toBe('playing');
  });
});

describe('two open tabs', () => {
  it('moves a replayed result out of the score even after its record was evicted', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));
    expect(result.current.scoreboard).toEqual({ X: 1, O: 0, draws: 0 });

    // Another tab finishes 25 games: this game's record falls out of the history.
    const others = Array.from({ length: 25 }, (_, i) => ({
      ...result.current.history[0],
      id: `other-${i}`,
      moves: null,
    }));
    // Like a real browser, the event carries the new value.
    const newValue = JSON.stringify(others);
    window.localStorage.setItem('ttt-lab:history', newValue);
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: 26, O: 0, draws: 0 }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'ttt-lab:history', newValue }));
    });
    expect(result.current.history.some((record) => record.id === result.current.game.id)).toBe(false);

    // Rewind this game and let O win instead: X's old win must leave the score.
    act(() => result.current.rewind(4));
    for (const cell of [8, 5]) act(() => result.current.play(cell));
    expect(result.current.scoreboard).toEqual({ X: 25, O: 1, draws: 0 });
  });

  it('extend the shared history instead of overwriting it', () => {
    const tabA = mount();
    const tabB = mount();
    act(() => tabA.result.current.startGame(twoPlayers));
    act(() => tabB.result.current.startGame(twoPlayers));

    // Tab A: X wins.
    for (const cell of [0, 3, 1, 4, 2]) act(() => tabA.result.current.play(cell));
    // The browser tells the other tab that localStorage changed.
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'ttt-lab:history',
          newValue: window.localStorage.getItem('ttt-lab:history'),
        })
      );
    });
    expect(tabB.result.current.history).toHaveLength(1);

    // Tab B: O wins.
    for (const cell of [0, 3, 1, 4, 8, 5]) act(() => tabB.result.current.play(cell));

    expect(stored('scoreboard')).toEqual({ X: 1, O: 1, draws: 0 });
    expect((stored('history') as unknown[]).length).toBe(2);
  });

  it('forgets the counted result when another tab clears the history', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));
    const won = result.current.history[0];

    // Another tab clears everything...
    const send = (key: string, value: unknown) => {
      const newValue = JSON.stringify(value);
      window.localStorage.setItem(key, newValue);
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
      });
    };
    send('ttt-lab:history', []);
    send('ttt-lab:scoreboard', { X: 0, O: 0, draws: 0 });
    send('ttt-lab:cleared-at', 'clear-1');
    // ...and then records an X win of its own.
    send('ttt-lab:history', [{ ...won, id: 'other-tab-game' }]);
    send('ttt-lab:scoreboard', { X: 1, O: 0, draws: 0 });
    expect(result.current.scoreboard).toEqual({ X: 1, O: 0, draws: 0 });

    // This tab's old X win was cleared, so replaying its game must not take
    // the other tab's X win away.
    act(() => result.current.rewind(4));
    for (const cell of [8, 5]) act(() => result.current.play(cell));
    expect(result.current.scoreboard).toEqual({ X: 1, O: 1, draws: 0 });
  });

  it('keeps the counted result when another tab writes corrupted history', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));

    // Garbage in the history, but the score (with this game's X win) untouched.
    const newValue = '{not json';
    window.localStorage.setItem('ttt-lab:history', newValue);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'ttt-lab:history', newValue }));
    });
    expect(result.current.history).toEqual([]);
    expect(result.current.scoreboard).toEqual({ X: 1, O: 0, draws: 0 });

    // Replaying the game must still move the old X win out of the score.
    act(() => result.current.rewind(4));
    for (const cell of [8, 5]) act(() => result.current.play(cell));
    expect(result.current.scoreboard).toEqual({ X: 0, O: 1, draws: 0 });
  });

  it('keeps the counted result when a third tab repairs corrupted history to []', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));

    // Tab C wrote garbage; tab B parsed it and wrote [] back. The score — with
    // this game's X win — was never cleared, and no clear was announced.
    const newValue = '[]';
    window.localStorage.setItem('ttt-lab:history', newValue);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'ttt-lab:history', newValue }));
    });
    expect(result.current.scoreboard).toEqual({ X: 1, O: 0, draws: 0 });

    act(() => result.current.rewind(4));
    for (const cell of [8, 5]) act(() => result.current.play(cell));
    expect(result.current.scoreboard).toEqual({ X: 0, O: 1, draws: 0 });
  });

  it('announces its own clear only after the cleared stats are stored', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));

    // What another tab would read at the moment the signal lands.
    let seenBySignal: unknown = null;
    const setItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      setItem.call(this, key, value);
      if (key === 'ttt-lab:cleared-at') {
        seenBySignal = { history: stored('history'), scoreboard: stored('scoreboard') };
      }
    });
    try {
      act(() => result.current.clearHistory());
    } finally {
      spy.mockRestore();
    }

    expect(seenBySignal).toEqual({ history: [], scoreboard: { X: 0, O: 0, draws: 0 } });
  });

  it('never writes back stats it adopted from another tab', () => {
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: 1, O: 0, draws: 0 }));
    const { result } = mount();
    expect(result.current.scoreboard).toEqual({ X: 1, O: 0, draws: 0 });

    // Another tab clears: this tab hears about the history first, and — as can
    // happen across processes — still reads the old score at that moment,
    // although the zeros have already been stored.
    window.localStorage.setItem('ttt-lab:history', '[]');
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: 0, O: 0, draws: 0 }));
    const getItem = Storage.prototype.getItem;
    let stale = true;
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key: string
    ) {
      if (stale && key === 'ttt-lab:scoreboard') {
        stale = false;
        return JSON.stringify({ X: 1, O: 0, draws: 0 });
      }
      return getItem.call(this, key);
    });
    try {
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: 'ttt-lab:history', newValue: '[]' }));
      });
    } finally {
      spy.mockRestore();
    }

    // The stale score may be shown for a moment, but it must not be stored.
    expect(stored('scoreboard')).toEqual({ X: 0, O: 0, draws: 0 });
  });

  it('records on top of a game another tab stored, even before its event arrives', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4]) act(() => result.current.play(cell));

    // Another tab finished an O win a moment ago; its storage event has not
    // been delivered here yet, so this tab's in-memory stats do not know it.
    const otherGame = {
      ...result.current.history[0],
      id: 'other-tab',
      playedAt: '2026-11-21T10:00:00.000Z',
      mode: 'classic',
      opponent: 'human',
      difficulty: null,
      size: 3,
      winLength: 3,
      players: { X: 'A', O: 'B' },
      result: 'O',
      reason: 'line',
      moveCount: 6,
      durationMs: 1000,
      moves: [0, 3, 1, 4, 8, 5],
      rewound: false,
      hinted: false,
    };
    window.localStorage.setItem('ttt-lab:history', JSON.stringify([otherGame]));
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: 0, O: 1, draws: 0 }));

    act(() => result.current.play(2)); // this tab's X win
    expect((stored('history') as { id: string }[]).map((record) => record.id)).toEqual([
      result.current.game.id,
      'other-tab',
    ]);
    expect(stored('scoreboard')).toEqual({ X: 1, O: 1, draws: 0 });
  });

  it('ignores changes to unrelated keys', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell));
    window.localStorage.setItem('ttt-lab:history', '[]');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-app' }));
    });
    expect(result.current.history).toHaveLength(1);
  });
});

describe('blocked storage', () => {
  it('keeps the session history and score when localStorage refuses writes', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));
    // Quota exceeded / storage blocked from here on.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell)); // X wins
      act(() => result.current.restart());
      for (const cell of [0, 3, 1, 4, 8, 5]) act(() => result.current.play(cell)); // O wins
    } finally {
      spy.mockRestore();
    }

    expect(result.current.history.map((record) => record.result)).toEqual(['O', 'X']);
    expect(result.current.scoreboard).toEqual({ X: 1, O: 1, draws: 0 });
  });
});

describe('storage that recovers', () => {
  it('replays unsaved games on top of what another tab stored meanwhile', () => {
    const { result } = mount();
    act(() => result.current.startGame(twoPlayers));

    // Writes fail while this tab wins its first game...
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell)); // X wins
    } finally {
      spy.mockRestore();
    }
    const ownFirst = result.current.history[0];

    // ...storage recovers, and another tab stores an O win of its own.
    const otherGame = { ...ownFirst, id: 'other-tab', result: 'O', moveCount: 6, moves: [0, 3, 1, 4, 8, 5] };
    window.localStorage.setItem('ttt-lab:history', JSON.stringify([otherGame]));
    window.localStorage.setItem('ttt-lab:scoreboard', JSON.stringify({ X: 0, O: 1, draws: 0 }));

    // This tab's next game must keep the other tab's game AND its own first one.
    act(() => result.current.restart());
    for (const cell of [0, 3, 1, 4, 2]) act(() => result.current.play(cell)); // X wins again

    const ids = (stored('history') as { id: string }[]).map((record) => record.id);
    expect(ids).toHaveLength(3);
    expect(ids).toContain('other-tab');
    expect(ids).toContain(ownFirst.id);
    expect(stored('scoreboard')).toEqual({ X: 2, O: 1, draws: 0 });
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
