'use client';

import { useMemo } from 'react';
import {
  PHeading,
  PTable,
  PTableBody,
  PTableCell,
  PTableHead,
  PTableHeadCell,
  PTableHeadRow,
  PTableRow,
  PText,
} from '@porsche-design-system/components-react/ssr';
import { summarize } from '@/lib/game/stats';
import { DIFFICULTY_LEVELS, GAME_MODES, MODES } from '@/lib/game/types';
import type { MatchRecord } from '@/lib/game/types';

type Props = { history: MatchRecord[] };

const percent = (part: number, whole: number): string =>
  whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`;

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

export const StatsPanel = ({ history }: Props) => {
  const summary = useMemo(() => summarize(history), [history]);
  if (summary.games === 0) return null;

  const modes = GAME_MODES.filter((mode) => summary.byMode[mode]);
  const levels = DIFFICULTY_LEVELS.filter((level) => summary.vsComputer[level]);

  const tiles = [
    { label: 'Games stored', value: String(summary.games) },
    { label: 'Average moves', value: summary.averageMoves === null ? '—' : summary.averageMoves.toFixed(1) },
    { label: 'Best win streak vs computer', value: String(summary.bestStreak) },
  ];

  return (
    <section className="panel">
      <PHeading size="sm" tag="h2">
        Statistics
      </PHeading>
      <PText size="xs" color="contrast-medium">
        Derived from the games stored in this browser.
      </PText>

      <div className="scoreboard">
        {tiles.map(({ label, value }) => (
          <div key={label} className="scoreboard__entry">
            <PText size="xl" weight="bold" tag="span">
              {value}
            </PText>
            <PText size="xs" color="contrast-medium">
              {label}
            </PText>
          </div>
        ))}
      </div>

      <PTable caption="Results by mode" compact>
        <PTableHead>
          <PTableHeadRow>
            <PTableHeadCell>Mode</PTableHeadCell>
            <PTableHeadCell>Games</PTableHeadCell>
            <PTableHeadCell>X wins</PTableHeadCell>
            <PTableHeadCell>O wins</PTableHeadCell>
            <PTableHeadCell>Draws</PTableHeadCell>
          </PTableHeadRow>
        </PTableHead>
        <PTableBody>
          {modes.map((mode) => {
            const tally = summary.byMode[mode]!;
            return (
              <PTableRow key={mode}>
                <PTableCell>{MODES[mode].label}</PTableCell>
                <PTableCell>{String(tally.games)}</PTableCell>
                <PTableCell>{String(tally.X)}</PTableCell>
                <PTableCell>{String(tally.O)}</PTableCell>
                <PTableCell>{String(tally.draws)}</PTableCell>
              </PTableRow>
            );
          })}
        </PTableBody>
      </PTable>

      {levels.length > 0 && (
        <PTable caption="Your results against the computer" compact>
          <PTableHead>
            <PTableHeadRow>
              <PTableHeadCell>Level</PTableHeadCell>
              <PTableHeadCell>Games</PTableHeadCell>
              <PTableHeadCell>Won</PTableHeadCell>
              <PTableHeadCell>Lost</PTableHeadCell>
              <PTableHeadCell>Drawn</PTableHeadCell>
              <PTableHeadCell>Win rate</PTableHeadCell>
            </PTableHeadRow>
          </PTableHead>
          <PTableBody>
            {levels.map((level) => {
              const tally = summary.vsComputer[level]!;
              return (
                <PTableRow key={level}>
                  <PTableCell>{capitalize(level)}</PTableCell>
                  <PTableCell>{String(tally.games)}</PTableCell>
                  <PTableCell>{String(tally.wins)}</PTableCell>
                  <PTableCell>{String(tally.losses)}</PTableCell>
                  <PTableCell>{String(tally.draws)}</PTableCell>
                  <PTableCell>{percent(tally.wins, tally.games)}</PTableCell>
                </PTableRow>
              );
            })}
          </PTableBody>
        </PTable>
      )}
    </section>
  );
};
