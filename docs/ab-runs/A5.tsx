'use client';

import { useState } from 'react';
import {
  PButton,
  PHeading,
  PInputText,
  PSegmentedControl,
  PSegmentedControlItem,
  PText,
} from '@porsche-design-system/components-react';
import { DEFAULT_SETTINGS, MODES, TURN_SECONDS_OPTIONS, normalizeSettings } from '@/lib/game/types';
import type { Difficulty, GameMode, Opponent, Settings } from '@/lib/game/types';

type Props = {
  initial?: Settings;
  onStart: (settings: Settings) => void;
};

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const OPPONENTS: { value: Opponent; label: string }[] = [
  { value: 'ai', label: 'Computer' },
  { value: 'human', label: 'Two players' },
];

const MAX_NAME_LENGTH = 16;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function SettingsForm({ initial = DEFAULT_SETTINGS, onStart }: Props) {
  const [settings, setSettings] = useState<Settings>(() => normalizeSettings(initial));

  const config = MODES[settings.mode];
  const winLengths = config.winLengths(settings.size);

  const update = (patch: Partial<Settings>) =>
    setSettings((current) => normalizeSettings({ ...current, ...patch }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = (value: string, fallback: string) => value.trim() || fallback;
    onStart(
      normalizeSettings({
        ...settings,
        playerXName: trimmed(settings.playerXName, DEFAULT_SETTINGS.playerXName),
        playerOName: trimmed(
          settings.playerOName,
          settings.opponent === 'ai' ? DEFAULT_SETTINGS.playerOName : 'Player 2'
        ),
      })
    );
  };

  return (
    <form
      onSubmit={submit}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 520 }}
    >
      <PHeading size="large" tag="h2">
        Game settings
      </PHeading>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PText weight="semi-bold">Mode</PText>
        <PSegmentedControl
          aria-label="Game mode"
          value={settings.mode}
          onChange={(e) => update({ mode: e.detail.value as GameMode })}
        >
          {(Object.keys(MODES) as GameMode[]).map((mode) => (
            <PSegmentedControlItem key={mode} value={mode} label={MODES[mode].label} />
          ))}
        </PSegmentedControl>
        <PText size="small" color="contrast-medium">
          {config.tagline}
        </PText>
      </section>

      {config.sizes.length > 1 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PText weight="semi-bold">Board size</PText>
          <PSegmentedControl
            aria-label="Board size"
            value={settings.size}
            onChange={(e) => update({ size: Number(e.detail.value) })}
          >
            {config.sizes.map((size) => (
              <PSegmentedControlItem key={size} value={size} label={`${size}x${size}`} />
            ))}
          </PSegmentedControl>
        </section>
      )}

      {winLengths.length > 1 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PText weight="semi-bold">Marks in a row to win</PText>
          <PSegmentedControl
            aria-label="Marks in a row to win"
            value={settings.winLength}
            onChange={(e) => update({ winLength: Number(e.detail.value) })}
          >
            {winLengths.map((length) => (
              <PSegmentedControlItem key={length} value={length} label={String(length)} />
            ))}
          </PSegmentedControl>
        </section>
      )}

      {config.timed && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PText weight="semi-bold">Time per move</PText>
          <PSegmentedControl
            aria-label="Time per move"
            value={settings.turnSeconds}
            onChange={(e) => update({ turnSeconds: Number(e.detail.value) })}
          >
            {TURN_SECONDS_OPTIONS.map((seconds) => (
              <PSegmentedControlItem key={seconds} value={seconds} label={`${seconds} s`} />
            ))}
          </PSegmentedControl>
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PText weight="semi-bold">Opponent</PText>
        <PSegmentedControl
          aria-label="Opponent"
          value={settings.opponent}
          onChange={(e) => update({ opponent: e.detail.value as Opponent })}
        >
          {OPPONENTS.map((opponent) => (
            <PSegmentedControlItem key={opponent.value} value={opponent.value} label={opponent.label} />
          ))}
        </PSegmentedControl>
      </section>

      {settings.opponent === 'ai' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PText weight="semi-bold">Difficulty</PText>
          <PSegmentedControl
            aria-label="Difficulty"
            value={settings.difficulty}
            onChange={(e) => update({ difficulty: e.detail.value as Difficulty })}
          >
            {DIFFICULTIES.map((difficulty) => (
              <PSegmentedControlItem key={difficulty} value={difficulty} label={capitalize(difficulty)} />
            ))}
          </PSegmentedControl>
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PInputText
          name="playerXName"
          label="Player X name"
          maxLength={MAX_NAME_LENGTH}
          value={settings.playerXName}
          onInput={(e) => update({ playerXName: (e.target as unknown as HTMLInputElement).value })}
        />
        <PInputText
          name="playerOName"
          label={settings.opponent === 'ai' ? 'Computer name' : 'Player O name'}
          maxLength={MAX_NAME_LENGTH}
          value={settings.playerOName}
          onInput={(e) => update({ playerOName: (e.target as unknown as HTMLInputElement).value })}
        />
      </section>

      <div style={{ display: 'flex', gap: 12 }}>
        <PButton type="submit" variant="primary">
          Start game
        </PButton>
        <PButton
          type="button"
          variant="secondary"
          onClick={() => setSettings(normalizeSettings(DEFAULT_SETTINGS))}
        >
          Reset
        </PButton>
      </div>
    </form>
  );
}
