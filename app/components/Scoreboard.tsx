'use client';

import { PHeading, PText } from '@porsche-design-system/components-react/ssr';
import type { Scoreboard as ScoreboardData, Settings } from '@/lib/game/types';

type Props = {
  scoreboard: ScoreboardData;
  settings: Settings;
};

export const Scoreboard = ({ scoreboard, settings }: Props) => {
  const entries = [
    { key: 'X', label: settings.playerXName, value: scoreboard.X },
    { key: 'O', label: settings.playerOName, value: scoreboard.O },
    { key: 'draws', label: 'Draws', value: scoreboard.draws },
  ];

  return (
    <section className="panel">
      <PHeading size="sm" tag="h2">
        Score
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
