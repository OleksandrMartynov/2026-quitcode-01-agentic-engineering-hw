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
import { DEFAULT_SETTINGS, MODES, TURN_SECONDS_OPTIONS, normalizeSettings } from '@/lib/game/types';
import type { Difficulty, GameMode, Opponent, Settings } from '@/lib/game/types';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
const MODE_KEYS = Object.keys(MODES) as GameMode[];

type SettingsScreenProps = {
  initialSettings?: Settings;
  onStart: (settings: Settings) => void;
};

export const SettingsScreen = ({ initialSettings = DEFAULT_SETTINGS, onStart }: SettingsScreenProps) => {
  const [draft, setDraft] = useState<Settings>(() => normalizeSettings(initialSettings));

  // Every change goes through normalizeSettings so size/winLength never leave
  // the range allowed by the selected mode (e.g. after switching grand -> classic).
  const update = (patch: Partial<Settings>) =>
    setDraft((current) => normalizeSettings({ ...current, ...patch }));

  const config = MODES[draft.mode];
  const winLengths = config.winLengths(draft.size);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onStart(normalizeSettings(draft));
  };

  return (
    <form onSubmit={handleSubmit}>
      <PHeading tag="h1" size="large">
        New game
      </PHeading>

      <PSegmentedControl
        name="mode"
        label="Mode"
        value={draft.mode}
        onChange={(event) => update({ mode: event.detail.value as GameMode })}
      >
        {MODE_KEYS.map((mode) => (
          <PSegmentedControlItem key={mode} value={mode} label={MODES[mode].label} />
        ))}
      </PSegmentedControl>
      <PText size="small">{config.tagline}</PText>

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
          {DIFFICULTIES.map((difficulty) => (
            <PSelectOption key={difficulty} value={difficulty}>
              {DIFFICULTY_LABELS[difficulty]}
            </PSelectOption>
          ))}
        </PSelect>
      )}

      <PInputText
        name="playerXName"
        label="Player X name"
        value={draft.playerXName}
        maxLength={16}
        onInput={(event) => update({ playerXName: (event.target as HTMLInputElement).value })}
      />
      <PInputText
        name="playerOName"
        label={draft.opponent === 'ai' ? 'Computer name' : 'Player O name'}
        value={draft.playerOName}
        maxLength={16}
        onInput={(event) => update({ playerOName: (event.target as HTMLInputElement).value })}
      />

      <PButton type="submit" icon="play">
        Start game
      </PButton>
    </form>
  );
};
