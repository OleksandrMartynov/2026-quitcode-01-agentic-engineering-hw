'use client';

import { PButton } from '@porsche-design-system/components-react/ssr';
import { doomedMarks } from '@/lib/game/engine';
import type { GameState } from '@/lib/game/types';

type Props = {
  game: GameState;
  /** Omit for a display-only board, e.g. the replay viewer. */
  onPlay?: (index: number) => void;
  locked?: boolean;
  /** Cell to highlight as the suggested move. */
  hint?: number | null;
  /** Accessible name of the whole board. */
  label?: string;
};

const cellLabel = (index: number, size: number, mark: string | null): string =>
  `Row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}${mark ? `, ${mark}` : ''}`;

export const Board = ({ game, onPlay, locked = false, hint = null, label }: Props) => {
  const { board, settings, outcome } = game;
  const winningLine = outcome.type === 'win' ? outcome.line : [];
  const doomed = doomedMarks(game);
  // A finished game, like a replay, is not interactive: its cells render as
  // plain squares instead of buttons that would be announced but do nothing.
  const readOnly = onPlay === undefined || outcome.type !== 'playing';

  return (
    <div
      className="board"
      style={{ gridTemplateColumns: `repeat(${settings.size}, minmax(0, 1fr))` }}
      role="group"
      aria-label={label ?? `${settings.size} by ${settings.size} board`}
    >
      {board.map((cell, index) => {
        const won = winningLine.includes(index);
        const mark = (
          <span
            className="board__mark"
            data-mark={cell ?? 'empty'}
            data-doomed={doomed.includes(index) ? 'true' : undefined}
            data-won={won ? 'true' : undefined}
            data-hint={hint === index ? 'true' : undefined}
          >
            {cell ?? (hint === index ? '•' : ' ')}
          </span>
        );

        if (readOnly) {
          return (
            <div
              key={index}
              className="board__cell board__cell--static"
              data-won={won ? 'true' : undefined}
              role="img"
              aria-label={`${cellLabel(index, settings.size, cell)}${won ? ', winning line' : ''}`}
            >
              {mark}
            </div>
          );
        }

        return (
          <PButton
            key={index}
            className="board__cell"
            type="button"
            variant="secondary"
            icon="none"
            // Taken cells stay enabled so marks keep full contrast (a disabled
            // PDS button is drawn at 40 % opacity); the engine ignores clicks
            // on them. Only the computer's turn locks the board.
            disabled={locked}
            aria={{
              'aria-label': `${cellLabel(index, settings.size, cell)}${hint === index ? ', suggested move' : ''}`,
            }}
            onClick={() => onPlay?.(index)}
          >
            {mark}
          </PButton>
        );
      })}
    </div>
  );
};
