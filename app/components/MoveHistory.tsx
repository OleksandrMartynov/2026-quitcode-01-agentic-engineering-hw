'use client';

import { PButtonPure, PHeading, PText } from '@porsche-design-system/components-react/ssr';
import { HUMAN } from '@/lib/game/types';
import type { GameState } from '@/lib/game/types';

type Props = {
  game: GameState;
  onRewind: (moveCount: number) => void;
  /** Against the computer, only your own moves are offered as rewind points. */
  humanOnly: boolean;
};

const cellName = (index: number, size: number): string =>
  `${String.fromCharCode(65 + (index % size))}${Math.floor(index / size) + 1}`;

export const MoveHistory = ({ game, onRewind, humanOnly }: Props) => {
  const { moves, settings } = game;

  // Rewinding to move n means replaying the first n-1 moves, which puts that
  // player back on turn. Against the computer only your own moves qualify,
  // otherwise the rewind would immediately be answered by the AI.
  const rewindPoints = moves
    .map((move, position) => ({ move, position }))
    .filter(({ move }) => !humanOnly || move.player === HUMAN);

  return (
    <section className="panel">
      <PHeading size="sm" tag="h2">
        Moves
      </PHeading>

      {moves.length === 0 ? (
        <PText size="xs" color="contrast-medium">
          No moves yet. Every move becomes a point you can rewind to.
        </PText>
      ) : (
        <>
          <PText size="xs" color="contrast-medium">
            Pick a move to take the board back to it.
          </PText>
          <ol className="stack moves">
            {rewindPoints.map(({ move, position }) => (
              <li key={position}>
                <PButtonPure type="button" size="xs" icon="reset" onClick={() => onRewind(position)}>
                  {`${position + 1}. ${move.player} → ${cellName(move.index, settings.size)}${
                    move.removed === null
                      ? ''
                      : ` (${cellName(move.removed, settings.size)} vanished)`
                  }`}
                </PButtonPure>
              </li>
            ))}
          </ol>
          <PButtonPure type="button" size="xs" icon="delete" onClick={() => onRewind(0)}>
            Back to the empty board
          </PButtonPure>
        </>
      )}
    </section>
  );
};
