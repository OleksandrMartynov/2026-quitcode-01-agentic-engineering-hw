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

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const OPPONENTS: { value: Opponent; label: string }[] = [
  { value: 'ai', label: 'Computer' },
  { value: 'human', label: 'Human' },
];

const MODE_KEYS = Object.keys(MODES) as GameMode[];

// Narrowing helpers: PDS events carry plain strings/numbers, not our unions.
const isMode = (value: string): value is GameMode => value in MODES;
const isDifficulty = (value: string): value is Difficulty =>
  DIFFICULTIES.some((d) => d.value === value);
const isOpponent = (value: string): value is Opponent => OPPONENTS.some((o) => o.value === value);

export const SettingsScreen = ({ initialSettings = DEFAULT_SETTINGS, onStart }: SettingsScreenProps) => {
  const [settings, setSettings] = useState<Settings>(() => normalizeSettings(initialSettings));

  const config = MODES[settings.mode];
  const sizes = config.sizes;
  const winLengths = config.winLengths(settings.size);

  // Every patch goes through normalizeSettings so size/winLength never leave the mode's limits
  // (changing mode or size re-clamps the dependent fields).
  const update = (patch: Partial<Settings>) =>
    setSettings((prev) => normalizeSettings({ ...prev, ...patch }));

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
          const value = String(e.detail.value);
          if (isMode(value)) update({ mode: value });
        }}
      >
        {MODE_KEYS.map((key) => (
          <PSelectOption key={key} value={key}>
            {MODES[key].label}
          </PSelectOption>
        ))}
      </PSelect>

      {sizes.length > 1 && (
        <PSegmentedControl
          // key forces a remount so the control re-reads the clamped value after a mode switch
          key={`size-${settings.mode}`}
          name="size"
          label="Board size"
          value={settings.size}
          onChange={(e) => update({ size: Number(e.detail.value) })}
        >
          {sizes.map((s) => (
            <PSegmentedControlItem key={s} value={s}>
              {`${s}x${s}`}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      {winLengths.length > 1 && (
        <PSegmentedControl
          key={`win-${settings.mode}-${settings.size}`}
          name="winLength"
          label="Marks in a row to win"
          value={settings.winLength}
          onChange={(e) => update({ winLength: Number(e.detail.value) })}
        >
          {winLengths.map((n) => (
            <PSegmentedControlItem key={n} value={n}>
              {String(n)}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      {config.timed && (
        <PSegmentedControl
          name="turnSeconds"
          label="Seconds per move"
          value={settings.turnSeconds}
          onChange={(e) => update({ turnSeconds: Number(e.detail.value) })}
        >
          {TURN_SECONDS_OPTIONS.map((s) => (
            <PSegmentedControlItem key={s} value={s}>
              {`${s} s`}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      <PSegmentedControl
        name="opponent"
        label="Opponent"
        value={settings.opponent}
        onChange={(e) => {
          const value = String(e.detail.value);
          if (isOpponent(value)) update({ opponent: value });
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
          name="difficulty"
          label="Difficulty"
          value={settings.difficulty}
          onChange={(e) => {
            const value = String(e.detail.value);
            if (isDifficulty(value)) update({ difficulty: value });
          }}
        >
          {DIFFICULTIES.map((d) => (
            <PSegmentedControlItem key={d.value} value={d.value}>
              {d.label}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      <PInputText
        name="playerXName"
        label="Player X name"
        value={settings.playerXName}
        maxLength={20}
        onInput={(e) => update({ playerXName: (e.target as HTMLInputElement).value })}
      />

      {/* The O player is the computer when playing against the AI, but the name is still editable. */}
      <PInputText
        name="playerOName"
        label="Player O name"
        value={settings.playerOName}
        maxLength={20}
        onInput={(e) => update({ playerOName: (e.target as HTMLInputElement).value })}
      />

      <PText size="small">
        {`${settings.size}x${settings.size} board, ${settings.winLength} in a row to win.`}
      </PText>

      <PButton type="submit">Start game</PButton>
    </form>
  );
};

export default SettingsScreen;
