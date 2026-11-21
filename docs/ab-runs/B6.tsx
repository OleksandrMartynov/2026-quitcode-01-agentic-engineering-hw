'use client';

import { useState, type FormEvent } from 'react';
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
import {
  DEFAULT_SETTINGS,
  MODES,
  TURN_SECONDS_OPTIONS,
  normalizeSettings,
  type Difficulty,
  type GameMode,
  type Opponent,
  type Settings,
} from '@/lib/game/types';

type SettingsScreenProps = {
  initialSettings?: Settings;
  onStart: (settings: Settings) => void;
};

const MODE_KEYS = Object.keys(MODES) as GameMode[];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const OPPONENTS: { value: Opponent; label: string }[] = [
  { value: 'ai', label: 'Computer' },
  { value: 'human', label: 'Human' },
];

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

// PDS value-bearing events carry string | number; narrow to the expected union member.
const isOneOf = <T extends string | number>(options: readonly T[], value: unknown): value is T =>
  (options as readonly unknown[]).includes(value);

export const SettingsScreen = ({ initialSettings = DEFAULT_SETTINGS, onStart }: SettingsScreenProps) => {
  const [settings, setSettings] = useState<Settings>(() => normalizeSettings(initialSettings));

  const config = MODES[settings.mode];
  const winLengths = config.winLengths(settings.size);

  // Every update goes through normalizeSettings so size/winLength never leave the mode's limits.
  const update = (patch: Partial<Settings>) => setSettings((prev) => normalizeSettings({ ...prev, ...patch }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onStart(normalizeSettings(settings));
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <PHeading size="large" tag="h1">
        New game
      </PHeading>

      <PSelect
        name="mode"
        label="Mode"
        description={config.tagline}
        value={settings.mode}
        onChange={(e) => {
          if (isOneOf(MODE_KEYS, e.detail.value)) update({ mode: e.detail.value });
        }}
      >
        {MODE_KEYS.map((key) => (
          <PSelectOption key={key} value={key}>
            {MODES[key].label}
          </PSelectOption>
        ))}
      </PSelect>

      {config.sizes.length > 1 && (
        <PSegmentedControl
          label="Board size"
          value={settings.size}
          onChange={(e) => {
            if (isOneOf(config.sizes, e.detail.value)) update({ size: e.detail.value });
          }}
        >
          {config.sizes.map((size) => (
            <PSegmentedControlItem key={size} value={size}>
              {`${size}x${size}`}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      {winLengths.length > 1 && (
        <PSegmentedControl
          label="Marks in a row to win"
          value={settings.winLength}
          onChange={(e) => {
            if (isOneOf(winLengths, e.detail.value)) update({ winLength: e.detail.value });
          }}
        >
          {winLengths.map((length) => (
            <PSegmentedControlItem key={length} value={length}>
              {String(length)}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      <PSegmentedControl
        label="Opponent"
        value={settings.opponent}
        onChange={(e) => {
          const values = OPPONENTS.map((o) => o.value);
          if (isOneOf(values, e.detail.value)) update({ opponent: e.detail.value });
        }}
      >
        {OPPONENTS.map((o) => (
          <PSegmentedControlItem key={o.value} value={o.value}>
            {o.label}
          </PSegmentedControlItem>
        ))}
      </PSegmentedControl>

      {settings.opponent === 'ai' && (
        <PSegmentedControl
          label="Difficulty"
          value={settings.difficulty}
          onChange={(e) => {
            if (isOneOf(DIFFICULTIES, e.detail.value)) update({ difficulty: e.detail.value });
          }}
        >
          {DIFFICULTIES.map((d) => (
            <PSegmentedControlItem key={d} value={d}>
              {capitalize(d)}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      {config.timed && (
        <PSegmentedControl
          label="Seconds per move"
          value={settings.turnSeconds}
          onChange={(e) => {
            if (isOneOf(TURN_SECONDS_OPTIONS, e.detail.value)) update({ turnSeconds: e.detail.value });
          }}
        >
          {TURN_SECONDS_OPTIONS.map((seconds) => (
            <PSegmentedControlItem key={seconds} value={seconds}>
              {`${seconds} s`}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      <PInputText
        name="playerXName"
        label={settings.opponent === 'ai' ? 'Your name (X)' : 'Player X name'}
        value={settings.playerXName}
        maxLength={20}
        onInput={(e) => update({ playerXName: (e.target as HTMLInputElement).value })}
      />

      {/* The AI always plays O under a fixed name, so its name field is only for human opponents. */}
      {settings.opponent === 'human' && (
        <PInputText
          name="playerOName"
          label="Player O name"
          value={settings.playerOName}
          maxLength={20}
          onInput={(e) => update({ playerOName: (e.target as HTMLInputElement).value })}
        />
      )}

      <PText size="small">
        {`${settings.size}x${settings.size} board, ${settings.winLength} in a row to win.`}
      </PText>

      <PButton type="submit">Start game</PButton>
    </form>
  );
};

export default SettingsScreen;
