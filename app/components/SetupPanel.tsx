'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  PButton,
  PHeading,
  PInputText,
  PSegmentedControl,
  PSegmentedControlItem,
  PSelect,
  PSelectOption,
  PText,
} from '@porsche-design-system/components-react/ssr';
import { MODES, TURN_SECONDS_OPTIONS, normalizeSettings } from '@/lib/game/types';
import type { Difficulty, GameMode, Opponent, Settings } from '@/lib/game/types';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy — plays at random' },
  { value: 'medium', label: 'Medium — wins and blocks' },
  { value: 'hard', label: 'Hard — full minimax search' },
];

type Props = {
  settings: Settings;
  onStart: (settings: Settings) => void;
  onRestart: () => void;
};

export const SetupPanel = ({ settings, onStart, onRestart }: Props) => {
  const [draft, setDraft] = useState<Settings>(settings);
  const [applied, setApplied] = useState<Settings>(settings);

  // When a game starts with different settings, the form follows. Adjusting
  // state during render is React's recommended alternative to a sync effect.
  if (applied !== settings) {
    setApplied(settings);
    setDraft(settings);
  }

  const update = (patch: Partial<Settings>) =>
    setDraft((current) => normalizeSettings({ ...current, ...patch }));

  const config = MODES[draft.mode];
  const winLengths = config.winLengths(draft.size);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(draft);
  };

  return (
    <form className="panel" onSubmit={submit}>
      <PHeading size="sm" tag="h2">
        Game setup
      </PHeading>

      <PSegmentedControl
        name="mode"
        label="Mode"
        value={draft.mode}
        columns={2}
        onChange={(event) => update({ mode: event.detail.value as GameMode })}
      >
        {(Object.keys(MODES) as GameMode[]).map((mode) => (
          <PSegmentedControlItem key={mode} value={mode} label={MODES[mode].label} />
        ))}
      </PSegmentedControl>

      <PText size="xs" color="contrast-medium">
        {config.tagline}
      </PText>

      {config.sizes.length > 1 && (
        <PSelect
          name="size"
          label="Board size"
          value={String(draft.size)}
          onChange={(event) => update({ size: Number(event.detail.value) })}
        >
          {config.sizes.map((size) => (
            <PSelectOption key={size} value={String(size)}>
              {`${size} x ${size}`}
            </PSelectOption>
          ))}
        </PSelect>
      )}

      {winLengths.length > 1 && (
        <PSelect
          name="winLength"
          label="Marks in a row to win"
          value={String(draft.winLength)}
          onChange={(event) => update({ winLength: Number(event.detail.value) })}
        >
          {winLengths.map((length) => (
            <PSelectOption key={length} value={String(length)}>
              {String(length)}
            </PSelectOption>
          ))}
        </PSelect>
      )}

      {config.timed && (
        <PSelect
          name="turnSeconds"
          label="Seconds per move"
          value={String(draft.turnSeconds)}
          onChange={(event) => update({ turnSeconds: Number(event.detail.value) })}
        >
          {TURN_SECONDS_OPTIONS.map((seconds) => (
            <PSelectOption key={seconds} value={String(seconds)}>
              {`${seconds} s`}
            </PSelectOption>
          ))}
        </PSelect>
      )}

      <PSegmentedControl
        name="opponent"
        label="Opponent"
        value={draft.opponent}
        columns={2}
        onChange={(event) => update({ opponent: event.detail.value as Opponent })}
      >
        <PSegmentedControlItem value="ai" label="Computer" />
        <PSegmentedControlItem value="human" label="Two players" />
      </PSegmentedControl>

      {draft.opponent === 'ai' && (
        <PSelect
          name="difficulty"
          label="Difficulty"
          value={draft.difficulty}
          onChange={(event) => update({ difficulty: event.detail.value as Difficulty })}
        >
          {DIFFICULTIES.map(({ value, label }) => (
            <PSelectOption key={value} value={value}>
              {label}
            </PSelectOption>
          ))}
        </PSelect>
      )}

      <PInputText
        name="playerXName"
        label="Player X"
        value={draft.playerXName}
        maxLength={16}
        onInput={(event) => update({ playerXName: (event.target as HTMLInputElement).value })}
      />
      <PInputText
        name="playerOName"
        label={draft.opponent === 'ai' ? 'Computer' : 'Player O'}
        value={draft.playerOName}
        maxLength={16}
        onInput={(event) => update({ playerOName: (event.target as HTMLInputElement).value })}
      />

      <div className="row">
        <PButton type="submit" icon="play">
          Start game
        </PButton>
        <PButton type="button" variant="secondary" icon="reset" onClick={onRestart}>
          Restart
        </PButton>
      </div>
    </form>
  );
};
