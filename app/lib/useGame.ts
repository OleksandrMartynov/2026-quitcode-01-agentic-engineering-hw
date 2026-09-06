'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chooseMove } from './game/ai';
import { applyMove, applyTimeout, createGame, rewindTo } from './game/engine';
import {
  EMPTY_SCOREBOARD,
  HISTORY_LIMIT,
  clearStoredMatches,
  loadHistory,
  loadScoreboard,
  loadSettings,
  saveHistory,
  saveScoreboard,
  saveSettings,
} from './game/storage';
import { AI, DEFAULT_SETTINGS, MODES, normalizeSettings } from './game/types';
import type { GameState, MatchRecord, Scoreboard, Settings } from './game/types';

/** Long enough for the AI move to read as a reply rather than a glitch. */
const AI_THINKING_MS = 400;

/** Clock refresh rate — fine enough that the last second never looks stuck. */
const CLOCK_TICK_MS = 250;

const toRecord = (game: GameState): MatchRecord => {
  const { outcome, settings } = game;
  const result = outcome.type === 'draw' ? 'draw' : outcome.type === 'playing' ? 'draw' : outcome.winner;
  const reason = outcome.type === 'timeout' ? 'timeout' : outcome.type === 'win' ? 'line' : 'draw';

  return {
    id: game.id,
    playedAt: new Date().toISOString(),
    mode: settings.mode,
    opponent: settings.opponent,
    difficulty: settings.opponent === 'ai' ? settings.difficulty : null,
    size: settings.size,
    winLength: settings.winLength,
    result,
    reason,
    moveCount: game.moves.length,
    durationMs: Date.now() - game.startedAt,
  };
};

export const useGame = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [game, setGame] = useState<GameState>(() => createGame(DEFAULT_SETTINGS));
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [scoreboard, setScoreboard] = useState<Scoreboard>(EMPTY_SCOREBOARD);
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);
  const recordedRef = useRef<string | null>(null);

  // Stored state is read after mount so the server and the first client render
  // produce identical markup. This is the one place where a synchronous
  // setState in an effect is the correct SSR-safe pattern.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- see comment above */
    const stored = loadSettings();
    setSettings(stored);
    setGame(createGame(stored));
    setHistory(loadHistory());
    setScoreboard(loadScoreboard());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated) saveSettings(settings);
  }, [settings, hydrated]);

  const startGame = useCallback((next: Settings) => {
    const normalized = normalizeSettings(next);
    setSettings(normalized);
    setGame(createGame(normalized));
  }, []);

  const restart = useCallback(() => setGame((current) => createGame(current.settings)), []);

  const play = useCallback((index: number) => setGame((current) => applyMove(current, index)), []);

  const rewind = useCallback(
    (moveCount: number) => setGame((current) => rewindTo(current, moveCount)),
    []
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    setScoreboard(EMPTY_SCOREBOARD);
    clearStoredMatches();
  }, []);

  const aiTurn = settings.opponent === 'ai' && game.current === AI && game.outcome.type === 'playing';

  // The AI replies on a timer; the guard inside the updater keeps a stale
  // timeout from playing a second move after the position already changed.
  useEffect(() => {
    if (!aiTurn) return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (current.id !== game.id || current.moves.length !== game.moves.length) return current;
        const move = chooseMove(current);
        return move < 0 ? current : applyMove(current, move);
      });
    }, AI_THINKING_MS);
    return () => window.clearTimeout(timer);
  }, [aiTurn, game.id, game.moves.length]);

  // Blitz clock: it runs only while a human is on turn, and restarts on every
  // move. The remaining time is derived from the turn's timestamp rather than
  // counted down in state, so a slow frame cannot lose a second.
  const clockRunning = MODES[settings.mode].timed && game.outcome.type === 'playing' && !aiTurn;

  const secondsLeft = clockRunning
    ? Math.min(
        settings.turnSeconds,
        Math.max(0, Math.ceil((game.turnStartedAt + settings.turnSeconds * 1000 - now) / 1000))
      )
    : null;

  useEffect(() => {
    if (!clockRunning) return;
    const ticker = window.setInterval(() => {
      const moment = Date.now();
      setNow(moment);
      if (moment >= game.turnStartedAt + settings.turnSeconds * 1000) {
        setGame((current) => applyTimeout(current));
      }
    }, CLOCK_TICK_MS);
    return () => window.clearInterval(ticker);
  }, [clockRunning, settings.turnSeconds, game.turnStartedAt]);

  // A finished game is written to the history exactly once. Rewinding a
  // finished game clears the guard so the replayed result is recorded again.
  useEffect(() => {
    if (!hydrated) return;

    if (game.outcome.type === 'playing') {
      if (recordedRef.current === game.id) recordedRef.current = null;
      return;
    }
    if (recordedRef.current === game.id) return;
    recordedRef.current = game.id;

    const record = toRecord(game);
    setHistory((previous) => {
      const next = [record, ...previous].slice(0, HISTORY_LIMIT);
      saveHistory(next);
      return next;
    });
    setScoreboard((previous) => {
      const next: Scoreboard = {
        ...previous,
        ...(record.result === 'draw'
          ? { draws: previous.draws + 1 }
          : { [record.result]: previous[record.result] + 1 }),
      };
      saveScoreboard(next);
      return next;
    });
  }, [game, hydrated]);

  return {
    settings,
    game,
    history,
    scoreboard,
    secondsLeft,
    aiTurn,
    startGame,
    restart,
    play,
    rewind,
    clearHistory,
  };
};
