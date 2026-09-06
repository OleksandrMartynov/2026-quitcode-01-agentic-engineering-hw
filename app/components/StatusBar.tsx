'use client';

import { PSpinner, PTag, PText } from '@porsche-design-system/components-react/ssr';
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

  const variant =
    outcome.type === 'playing' ? 'secondary' : outcome.type === 'draw' ? 'warning' : 'success';

  return (
    <div className="row status">
      <PTag variant={variant} icon={outcome.type === 'playing' ? 'user' : 'success'}>
        {headline}
      </PTag>

      <PTag variant="info">{MODES[settings.mode].label}</PTag>
      <PTag>{`${settings.size} x ${settings.size} · ${settings.winLength} in a row`}</PTag>

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
