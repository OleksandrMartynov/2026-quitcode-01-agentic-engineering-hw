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
import {
  DEFAULT_SETTINGS,
  MODES,
  TURN_SECONDS_OPTIONS,
  normalizeSettings,
} from '@/lib/game/types';
import type { Difficulty, GameMode, Opponent, Settings } from '@/lib/game/types';

type SettingsScreenProps = {
  initialSettings?: Settings;
  onStart: (settings: Settings) => void;
};

const MODE_KEYS = Object.keys(MODES) as GameMode[];
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];
const OPPONENTS: { value: Opponent; label: string }[] = [
  { value: 'ai', label: 'Computer' },
  { value: 'human', label: 'Human' },
];

const isMode = (v: unknown): v is GameMode => MODE_KEYS.some((m) => m === v);
const isOpponent = (v: unknown): v is Opponent => OPPONENTS.some((o) => o.value === v);
const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.some((d) => d.value === v);

// The event target is the PDS host element (shadow DOM retargeting), not an HTMLInputElement.
const readValue = (target: EventTarget | null): string =>
  target !== null && 'value' in target ? String(target.value) : '';

export const SettingsScreen = ({ initialSettings = DEFAULT_SETTINGS, onStart }: SettingsScreenProps) => {
  const [settings, setSettings] = useState<Settings>(() => normalizeSettings(initialSettings));

  const config = MODES[settings.mode];
  const winLengths = config.winLengths(settings.size);

  // Every change goes through normalizeSettings so size/winLength stay within the mode's limits.
  const update = (patch: Partial<Settings>) =>
    setSettings((prev) => normalizeSettings({ ...prev, ...patch }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedX = settings.playerXName.trim();
    const trimmedO = settings.playerOName.trim();
    onStart(
      normalizeSettings({
        ...settings,
        playerXName: trimmedX || DEFAULT_SETTINGS.playerXName,
        playerOName: trimmedO || DEFAULT_SETTINGS.playerOName,
      })
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <PHeading size="large" tag="h1">
        New game
      </PHeading>

      <PSelect
        name="mode"
        label="Mode"
        value={settings.mode}
        onChange={(e) => {
          const next = e.detail.value;
          if (isMode(next)) update({ mode: next });
        }}
      >
        {MODE_KEYS.map((key) => (
          <PSelectOption key={key} value={key}>
            {MODES[key].label}
          </PSelectOption>
        ))}
      </PSelect>
      <PText size="small">{config.tagline}</PText>

      {config.sizes.length > 1 && (
        <PSegmentedControl
          // Remount on mode change so the control never keeps a stale selection.
          key={`size-${settings.mode}`}
          label="Board size"
          value={settings.size}
          onChange={(e) => update({ size: Number(e.detail.value) })}
        >
          {config.sizes.map((s) => (
            <PSegmentedControlItem key={s} value={s}>
              {`${s}x${s}`}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      {winLengths.length > 1 && (
        <PSegmentedControl
          key={`win-${settings.mode}-${settings.size}`}
          label="Marks in a row to win"
          value={settings.winLength}
          onChange={(e) => update({ winLength: Number(e.detail.value) })}
        >
          {winLengths.map((w) => (
            <PSegmentedControlItem key={w} value={w}>
              {String(w)}
            </PSegmentedControlItem>
          ))}
        </PSegmentedControl>
      )}

      {config.timed && (
        <PSegmentedControl
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
        label="Opponent"
        value={settings.opponent}
        onChange={(e) => {
          const next = e.detail.value;
          if (isOpponent(next)) update({ opponent: next });
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
            const next = e.detail.value;
            if (isDifficulty(next)) update({ difficulty: next });
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
        onInput={(e) => {
          update({ playerXName: readValue(e.target) });
        }}
      />

      {/* The AI's name is still part of Settings, so it stays editable. */}
      <PInputText
        name="playerOName"
        label={settings.opponent === 'ai' ? 'Computer name' : 'Player O name'}
        value={settings.playerOName}
        maxLength={20}
        onInput={(e) => {
          update({ playerOName: readValue(e.target) });
        }}
      />

      <PButton type="submit">Start game</PButton>
    </form>
  );
};

export default SettingsScreen;
