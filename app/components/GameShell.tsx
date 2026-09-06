'use client';

import { PHeading, PInlineNotification, PText } from '@porsche-design-system/components-react/ssr';
import { Board } from './Board';
import { MatchHistory } from './MatchHistory';
import { MoveHistory } from './MoveHistory';
import { Scoreboard } from './Scoreboard';
import { SetupPanel } from './SetupPanel';
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
    startGame,
    restart,
    play,
    rewind,
    clearHistory,
  } = useGame();

  const finished = game.outcome.type !== 'playing';

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

          <Board game={game} onPlay={play} locked={aiTurn} />

          {MODES[settings.mode].maxMarks !== Number.POSITIVE_INFINITY && (
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
              description="Start a new game from the setup panel, or step back through the moves to try another line."
              dismissButton={false}
              headingTag="h3"
            />
          )}
        </section>

        <div className="stack stack--gap">
          <Scoreboard scoreboard={scoreboard} settings={settings} />
          <MoveHistory game={game} onRewind={rewind} humanOnly={settings.opponent === 'ai'} />
        </div>
      </div>

      <MatchHistory history={history} settings={settings} onClear={clearHistory} />
    </main>
  );
};
