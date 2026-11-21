'use client';

import { useState } from 'react';
import {
  PButton,
  PHeading,
  PInlineNotification,
  PText,
} from '@porsche-design-system/components-react/ssr';
import { Board } from './Board';
import { MatchHistory } from './MatchHistory';
import { MoveHistory } from './MoveHistory';
import { ReplayPanel } from './ReplayPanel';
import { Scoreboard } from './Scoreboard';
import { SetupPanel } from './SetupPanel';
import { StatsPanel } from './StatsPanel';
import { StatusBar } from './StatusBar';
import { useGame } from '@/lib/useGame';
import { MODES } from '@/lib/game/types';

export const GameShell = () => {
  const {
    settings,
    game,
    history,
    scoreboard,
    secondsLeft,
    aiTurn,
    rewindable,
    hintCell,
    canHint,
    requestHint,
    startGame,
    restart,
    play,
    rewind,
    clearHistory,
  } = useGame();

  const finished = game.outcome.type !== 'playing';
  const [replayId, setReplayId] = useState<string | null>(null);
  // Looked up on every render: if the history is cleared, the replay closes.
  const replayed = history.find((record) => record.id === replayId) ?? null;

  return (
    <main className="app">
      <header className="app__header">
        <div className="stack">
          <PHeading size="xl" tag="h1">
            Tic-Tac-Toe Lab
          </PHeading>
          <PText color="contrast-medium">
            Four game modes and a minimax opponent, built on the Porsche Design System.
          </PText>
        </div>
      </header>

      <div className="app__layout">
        <SetupPanel settings={settings} onStart={startGame} onRestart={restart} />

        <section className="panel">
          <StatusBar game={game} secondsLeft={secondsLeft} thinking={aiTurn} />

          <Board game={game} onPlay={play} locked={aiTurn} hint={hintCell} />

          <div className="row">
            <PButton
              type="button"
              variant="secondary"
              icon="light"
              compact
              disabled={!canHint}
              onClick={requestHint}
            >
              Show a hint
            </PButton>
          </div>

          {Number.isFinite(MODES[game.settings.mode].maxMarks) && (
            <PInlineNotification
              state="info"
              heading="Vanishing rule"
              description="A faded mark disappears as soon as its owner places the next one, so this mode never ends in a draw."
              dismissButton={false}
              headingTag="h3"
            />
          )}

          {finished && (
            <PInlineNotification
              state="success"
              heading="Game over"
              description={
                rewindable
                  ? 'Start a new game from the setup panel, or step back through the moves to try another line.'
                  : 'Start a new game from the setup panel, or replay this one from the match history.'
              }
              dismissButton={false}
              headingTag="h3"
            />
          )}
        </section>

        <div className="stack stack--gap">
          <Scoreboard scoreboard={scoreboard} />
          <MoveHistory
            game={game}
            onRewind={rewind}
            humanOnly={game.settings.opponent === 'ai'}
            rewindable={rewindable}
          />
        </div>
      </div>

      {replayed && (
        <ReplayPanel key={`${replayed.id}:${replayed.playedAt}`} record={replayed} onClose={() => setReplayId(null)} />
      )}

      <MatchHistory history={history} onClear={clearHistory} onReplay={setReplayId} />

      <StatsPanel history={history} />
    </main>
  );
};
