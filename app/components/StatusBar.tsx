'use client';

import { PSpinner, PTag, PText } from '@porsche-design-system/components-react/ssr';
import { cellName } from '@/lib/game/notation';
import { MODES } from '@/lib/game/types';
import type { GameState, Player } from '@/lib/game/types';

type Props = {
  game: GameState;
  secondsLeft: number | null;
  thinking: boolean;
};

const nameOf = (game: GameState, player: Player): string =>
  player === 'X' ? game.settings.playerXName : game.settings.playerOName;

export const StatusBar = ({ game, secondsLeft, thinking }: Props) => {
  const { outcome, settings } = game;

  const headline = (() => {
    switch (outcome.type) {
      case 'win':
        return `Winner: ${nameOf(game, outcome.winner)} · ${settings.winLength} in a row`;
      case 'timeout':
        return `Time is up · winner: ${nameOf(game, outcome.winner)}`;
      case 'draw':
        return 'Draw — the board is full';
      case 'playing':
        return `${nameOf(game, game.current)} to move`;
    }
  })();

  // What a screen reader hears after every change: the last move, then the
  // state of the game. The visible tags are not a live region, because the
  // ticking clock would otherwise be announced every second.
  const lastMove = game.moves.at(-1);
  const announcement = [
    lastMove
      ? `${nameOf(game, lastMove.player)} played ${cellName(lastMove.index, settings.size)}${
          lastMove.removed === null ? '' : `, ${cellName(lastMove.removed, settings.size)} vanished`
        }.`
      : '',
    `${headline}.`,
  ]
    .filter(Boolean)
    .join(' ');

  const clockWaiting =
    MODES[settings.mode].timed && outcome.type === 'playing' && game.moves.length === 0;

  const variant =
    outcome.type === 'playing' ? 'secondary' : outcome.type === 'draw' ? 'warning' : 'success';

  return (
    <div className="row status">
      <PTag variant={variant} icon={outcome.type === 'playing' ? 'user' : 'success'}>
        {headline}
      </PTag>

      <PTag variant="info">{MODES[settings.mode].label}</PTag>
      <PTag>{`${settings.size} x ${settings.size} · ${settings.winLength} in a row`}</PTag>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      {clockWaiting && <PTag icon="clock">Clock starts after the first move</PTag>}

      {secondsLeft !== null && (
        <PTag variant={secondsLeft <= 3 ? 'error' : 'primary'} icon="clock">
          {`${secondsLeft}s left`}
        </PTag>
      )}

      {thinking && (
        <span className="row status__thinking">
          <PSpinner size="small" aria={{ 'aria-label': 'Computer is thinking' }} />
          <PText size="xs" color="contrast-medium">
            Thinking…
          </PText>
        </span>
      )}
    </div>
  );
};
