'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PButton,
  PButtonPure,
  PHeading,
  PInlineNotification,
  PText,
} from '@porsche-design-system/components-react/ssr';
import { Board } from './Board';
import { cellName } from '@/lib/game/notation';
import { replayFrames } from '@/lib/game/replay';
import { MODES } from '@/lib/game/types';
import type { MatchRecord } from '@/lib/game/types';

/** Pace of the automatic playback. */
export const REPLAY_STEP_MS = 700;

type Props = {
  record: MatchRecord;
  onClose: () => void;
};

const resultText = (record: MatchRecord): string => {
  if (record.result === 'draw') return 'Draw';
  const name = record.players[record.result];
  return record.reason === 'timeout' ? `${name} won on time` : `${name} won`;
};

/**
 * Steps through a stored match. Positions are rebuilt by the engine from the
 * stored move list, so the replay shows exactly the game that was recorded —
 * including marks removed by the vanishing rule.
 */
export const ReplayPanel = ({ record, onClose }: Props) => {
  const frames = useMemo(
    () => (record.moves === null ? null : replayFrames(record, record.moves)),
    [record]
  );
  const last = frames === null ? 0 : frames.length - 1;
  const [rawStep, setStep] = useState(last);
  const [playing, setPlaying] = useState(false);
  // The record can be replaced under an open replay (its game was rewound and
  // finished again with fewer moves), so the step is clamped to what exists.
  const step = Math.min(rawStep, last);

  // Playback stops on the final position. Adjusting state during render is
  // React's recommended alternative to a sync effect.
  if (playing && step >= last) setPlaying(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setStep((current) => Math.min(current + 1, last)),
      REPLAY_STEP_MS
    );
    return () => window.clearInterval(timer);
  }, [playing, last]);

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Playing from the final position starts over from the empty board.
    if (step >= last) setStep(0);
    setPlaying(true);
  };

  const goTo = (next: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(last, next)));
  };

  const title = `${MODES[record.mode].label} ${record.size}x${record.size} · ${resultText(record)}`;

  if (frames === null) {
    return (
      <section className="panel" aria-label="Replay">
        <PInlineNotification
          state="warning"
          heading="No replay for this game"
          description="It was played before moves were saved, or ran too long to store."
          dismissButton={false}
          headingTag="h3"
        />
        <PButtonPure type="button" icon="close" onClick={onClose}>
          Close replay
        </PButtonPure>
      </section>
    );
  }

  const frame = frames[step];
  const move = step === 0 ? null : frame.moves[step - 1];
  const caption =
    move === null
      ? 'Empty board'
      : `${step}. ${move.player} → ${cellName(move.index, record.size)}${
          move.removed === null ? '' : ` (${cellName(move.removed, record.size)} vanished)`
        }`;

  return (
    <section className="panel" aria-label="Replay">
      <div className="app__header">
        <PHeading size="sm" tag="h2">
          {`Replay · ${title}`}
        </PHeading>
        <PButtonPure type="button" icon="close" onClick={onClose}>
          Close
        </PButtonPure>
      </div>

      <div className="replay__board">
        <Board game={frame} label={`Replay, position after move ${step} of ${last}`} />
      </div>

      <PText size="xs" color="contrast-medium" aria-live="polite">
        {`${caption} · move ${step} of ${last}`}
      </PText>

      <div className="row">
        <PButton type="button" variant="secondary" icon="arrow-double-left" compact hideLabel disabled={step === 0} onClick={() => goTo(0)}>
          First position
        </PButton>
        <PButton type="button" variant="secondary" icon="arrow-left" compact hideLabel disabled={step === 0} onClick={() => goTo(step - 1)}>
          Previous move
        </PButton>
        <PButton type="button" variant="secondary" icon={playing ? 'pause' : 'play'} compact hideLabel disabled={last === 0} onClick={togglePlayback}>
          {playing ? 'Pause' : 'Play'}
        </PButton>
        <PButton type="button" variant="secondary" icon="arrow-right" compact hideLabel disabled={step === last} onClick={() => goTo(step + 1)}>
          Next move
        </PButton>
        <PButton type="button" variant="secondary" icon="arrow-double-right" compact hideLabel disabled={step === last} onClick={() => goTo(last)}>
          Final position
        </PButton>
      </div>
    </section>
  );
};
