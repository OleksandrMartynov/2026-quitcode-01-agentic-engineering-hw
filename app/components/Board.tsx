'use client';

import { PButton } from '@porsche-design-system/components-react/ssr';
import { doomedMarks } from '@/lib/game/engine';
import type { GameState } from '@/lib/game/types';

type Props = {
  game: GameState;
  onPlay: (index: number) => void;
  locked: boolean;
};

export const Board = ({ game, onPlay, locked }: Props) => {
  const { board, settings, outcome } = game;
  const winningLine = outcome.type === 'win' ? outcome.line : [];
  const doomed = doomedMarks(game);

  return (
    <div
      className="board"
      style={{ gridTemplateColumns: `repeat(${settings.size}, minmax(0, 1fr))` }}
      role="group"
      aria-label={`${settings.size} by ${settings.size} board`}
    >
      {board.map((cell, index) => {
        const row = Math.floor(index / settings.size) + 1;
        const column = (index % settings.size) + 1;
        const won = winningLine.includes(index);

        return (
          <PButton
            key={index}
            className="board__cell"
            type="button"
            variant={won ? 'primary' : 'secondary'}
            icon="none"
            // Cells stay enabled so marks and the winning line keep full contrast;
            // the engine ignores clicks on taken cells and on a finished game.
            // Only the computer's turn locks the board.
            disabled={locked}
            aria={{
              'aria-label': `Row ${row}, column ${column}`,
              'aria-pressed': cell !== null,
            }}
            onClick={() => onPlay(index)}
          >
            <span
              className="board__mark"
              data-mark={cell ?? 'empty'}
              data-doomed={doomed.includes(index) ? 'true' : undefined}
              data-won={won ? 'true' : undefined}
            >
              {cell ?? '\u00a0'}
            </span>
          </PButton>
        );
      })}
    </div>
  );
};
