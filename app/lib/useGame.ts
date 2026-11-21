'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chooseMove, suggestMove } from './game/ai';
import { applyMove, applyTimeout, createGame, isOutOfTime, rewindTo } from './game/engine';
import { EMPTY_STATS, recordMatch, toMatchRecord } from './game/stats';
import type { MatchStats } from './game/stats';
import {
  loadHistory,
  loadScoreboard,
  loadSettings,
  saveHistory,
  saveScoreboard,
  saveSettings,
  STORAGE_KEYS,
} from './game/storage';
import { AI, DEFAULT_SETTINGS, MODES, finalizeSettings } from './game/types';
import type { GameState, MatchRecord, Settings } from './game/types';

/** Long enough for the AI move to read as a reply rather than a glitch. */
export const AI_THINKING_MS = 400;

/** Clock refresh rate — fine enough that the last second never looks stuck. */
const CLOCK_TICK_MS = 250;

export const useGame = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [game, setGame] = useState<GameState>(() => createGame(DEFAULT_SETTINGS));
  const [stats, setStats] = useState<MatchStats>(EMPTY_STATS);
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);
  /** The finished game object that was last written to the stats. */
  const recordedRef = useRef<GameState | null>(null);
  /**
   * The result the current game last added to the score. Kept apart from the
   * history, which can lose the record (HISTORY_LIMIT, other tabs) while the
   * score still contains it.
   */
  const countedRef = useRef<{ id: string; result: MatchRecord['result'] } | null>(null);
  /**
   * A hint belongs to the exact position it was computed for. Keying it by the
   * game object (every move, rewind or restart creates a new one) makes a
   * stale hint impossible without any clean-up code.
   */
  const [hint, setHint] = useState<{ position: GameState; cell: number } | null>(null);

  // Stored state is read after mount so the server and the first client render
  // produce identical markup. This is the one place where a synchronous
  // setState in an effect is the correct SSR-safe pattern. Every loader
  // validates what it reads, so a corrupted entry is dropped here rather than
  // crashing the render and then being written back by the effects below.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- see comment above */
    const stored = loadSettings();
    setSettings(stored);
    setGame(createGame(stored));
    setStats({ history: loadHistory(), scoreboard: loadScoreboard() });
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persistence runs only after hydration, otherwise the defaults of the first
  // render would overwrite what is stored before it has been read.
  useEffect(() => {
    if (hydrated) saveSettings(settings);
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveHistory(stats.history);
    saveScoreboard(stats.scoreboard);
  }, [stats, hydrated]);

  // Another tab finished a game or cleared the history: adopt its stats, so
  // this tab's next write extends them instead of overwriting them.
  useEffect(() => {
    if (!hydrated) return;
    const watched: string[] = [STORAGE_KEYS.history, STORAGE_KEYS.scoreboard];
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !watched.includes(event.key)) return;
      setStats({ history: loadHistory(), scoreboard: loadScoreboard() });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [hydrated]);

  const startGame = useCallback((next: Settings) => {
    const finalized = finalizeSettings(next);
    setSettings(finalized);
    setGame(createGame(finalized));
  }, []);

  const restart = useCallback(() => setGame((current) => createGame(current.settings)), []);

  // The deadline is checked at the moment of the move, not only by the ticker.
  const play = useCallback(
    (index: number) =>
      setGame((current) =>
        isOutOfTime(current, Date.now()) ? applyTimeout(current) : applyMove(current, index)
      ),
    []
  );

  // Time travel would reset the blitz clock and undo losses on time, so timed
  // modes do not offer it.
  const rewind = useCallback(
    (moveCount: number) =>
      setGame((current) =>
        MODES[current.settings.mode].timed ? current : rewindTo(current, moveCount)
      ),
    []
  );

  const clearHistory = useCallback(() => {
    // A cleared score holds nothing that a replayed game could take back.
    countedRef.current = null;
    setStats(EMPTY_STATS);
  }, []);

  const aiTurn =
    game.settings.opponent === 'ai' && game.current === AI && game.outcome.type === 'playing';

  const canHint = hydrated && game.outcome.type === 'playing' && !aiTurn;
  const hintCell = hint !== null && hint.position === game ? hint.cell : null;

  const requestHint = useCallback(() => {
    if (!canHint) return;
    const cell = suggestMove(game);
    if (cell >= 0) setHint({ position: game, cell });
  }, [canHint, game]);

  // Every timer below captures the position it was started for; the updater
  // re-checks it, so a callback that fires after the position changed (a move,
  // a rewind, a new game) is ignored instead of acting on the wrong turn.
  const gameId = game.id;
  const moveCount = game.moves.length;
  const samePosition = useCallback(
    (current: GameState) => current.id === gameId && current.moves.length === moveCount,
    [gameId, moveCount]
  );

  useEffect(() => {
    if (!aiTurn) return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (!samePosition(current)) return current;
        const move = chooseMove(current);
        return move < 0 ? current : applyMove(current, move);
      });
    }, AI_THINKING_MS);
    return () => window.clearTimeout(timer);
  }, [aiTurn, samePosition]);

  // Blitz clock: it runs only while a human is on turn, and restarts on every
  // move. It starts with the first move, not with the game: a game is created
  // on page load, and a clock started then would hand a loss to anyone who
  // reloads the page or leaves it in a background tab. The remaining time is
  // derived from the turn's timestamp rather than counted down in state, so a
  // slow frame cannot lose a second.
  const { turnSeconds } = game.settings;
  const clockRunning =
    MODES[game.settings.mode].timed &&
    game.outcome.type === 'playing' &&
    game.moves.length > 0 &&
    !aiTurn;
  const deadline = game.turnStartedAt + turnSeconds * 1000;

  const secondsLeft = clockRunning
    ? Math.min(turnSeconds, Math.max(0, Math.ceil((deadline - now) / 1000)))
    : null;

  useEffect(() => {
    if (!clockRunning) return;
    const ticker = window.setInterval(() => {
      const moment = Date.now();
      setNow(moment);
      setGame((current) =>
        samePosition(current) && isOutOfTime(current, moment) ? applyTimeout(current) : current
      );
    }, CLOCK_TICK_MS);
    return () => window.clearInterval(ticker);
  }, [clockRunning, deadline, samePosition]);

  // Each finished game object is recorded once. Rewinding and finishing the
  // same game again yields a new object with the same id, which `recordMatch`
  // turns into a replacement of the earlier record, not a second entry.
  useEffect(() => {
    if (!hydrated || game.outcome.type === 'playing' || game.moves.length === 0) return;
    if (recordedRef.current === game) return;
    recordedRef.current = game;

    const record = toMatchRecord(game);
    const counted = countedRef.current?.id === game.id ? countedRef.current.result : null;
    countedRef.current = { id: game.id, result: record.result };
    setStats((previous) => recordMatch(previous, record, counted));
  }, [game, hydrated]);

  return {
    settings,
    game,
    history: stats.history,
    scoreboard: stats.scoreboard,
    secondsLeft,
    aiTurn,
    rewindable: !MODES[game.settings.mode].timed,
    hintCell,
    canHint,
    requestHint,
    startGame,
    restart,
    play,
    rewind,
    clearHistory,
  };
};
