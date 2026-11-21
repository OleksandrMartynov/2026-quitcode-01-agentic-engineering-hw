'use client';

import {
  PButton,
  PHeading,
  PTable,
  PTableBody,
  PTableCell,
  PTableHead,
  PTableHeadCell,
  PTableHeadRow,
  PTableRow,
  PTag,
  PText,
} from '@porsche-design-system/components-react/ssr';
import { MODES } from '@/lib/game/types';
import type { MatchRecord } from '@/lib/game/types';

type Props = {
  history: MatchRecord[];
  onClear: () => void;
};

const RESULT_VARIANT = {
  X: 'success',
  O: 'error',
  draw: 'warning',
} as const;

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

// Names come from the record itself, so renaming a player later does not
// rewrite who won the games already played.
const resultLabel = (record: MatchRecord): string => {
  if (record.result === 'draw') return 'Draw';
  const name = record.players[record.result];
  return record.reason === 'timeout' ? `${name} (on time)` : name;
};

export const MatchHistory = ({ history, onClear }: Props) => {
  return (
    <section className="panel">
      <div className="app__header">
        <PHeading size="sm" tag="h2">
          Match history
        </PHeading>
        <PButton
          type="button"
          variant="secondary"
          icon="delete"
          compact
          disabled={history.length === 0}
          onClick={onClear}
        >
          Clear history
        </PButton>
      </div>

      {history.length === 0 ? (
        <PText size="xs" color="contrast-medium">
          Finished games are stored in this browser and show up here.
        </PText>
      ) : (
        <PTable caption="Games played in this browser" compact>
          <PTableHead>
            <PTableHeadRow>
              <PTableHeadCell>Time</PTableHeadCell>
              <PTableHeadCell>Mode</PTableHeadCell>
              <PTableHeadCell>Opponent</PTableHeadCell>
              <PTableHeadCell>Result</PTableHeadCell>
              <PTableHeadCell>Moves</PTableHeadCell>
              <PTableHeadCell>Length</PTableHeadCell>
            </PTableHeadRow>
          </PTableHead>
          <PTableBody>
            {history.map((record) => (
              <PTableRow key={record.id}>
                <PTableCell>{formatTime(record.playedAt)}</PTableCell>
                <PTableCell>{`${MODES[record.mode].label} ${record.size}x${record.size}`}</PTableCell>
                <PTableCell>
                  {record.opponent === 'ai' ? `Computer (${record.difficulty})` : 'Two players'}
                </PTableCell>
                <PTableCell>
                  <PTag compact variant={RESULT_VARIANT[record.result]}>
                    {resultLabel(record)}
                  </PTag>
                </PTableCell>
                <PTableCell>{String(record.moveCount)}</PTableCell>
                <PTableCell>{formatDuration(record.durationMs)}</PTableCell>
              </PTableRow>
            ))}
          </PTableBody>
        </PTable>
      )}
    </section>
  );
};
