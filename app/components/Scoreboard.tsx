'use client';

import { PHeading, PText } from '@porsche-design-system/components-react/ssr';
import type { Scoreboard as ScoreboardData } from '@/lib/game/types';

type Props = {
  scoreboard: ScoreboardData;
};

/*
 * The score counts every game ever stored, by mark — across opponents and
 * player names. Labelling it with today's names would credit "Bob" with games
 * someone else won, so the labels name the marks instead.
 */
export const Scoreboard = ({ scoreboard }: Props) => {
  const entries = [
    { key: 'X', label: 'X wins', value: scoreboard.X },
    { key: 'O', label: 'O wins', value: scoreboard.O },
    { key: 'draws', label: 'Draws', value: scoreboard.draws },
  ];

  return (
    <section className="panel">
      <PHeading size="sm" tag="h2">
        All-time score
      </PHeading>
      <div className="scoreboard">
        {entries.map(({ key, label, value }) => (
          <div key={key} className="scoreboard__entry">
            <PText size="xl" weight="bold" tag="span">
              {String(value)}
            </PText>
            <PText size="xs" color="contrast-medium" ellipsis>
              {label}
            </PText>
          </div>
        ))}
      </div>
    </section>
  );
};
