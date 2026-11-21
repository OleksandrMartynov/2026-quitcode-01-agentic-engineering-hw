'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { MODES, TURN_SECONDS_OPTIONS, normalizeSettings } from '@/lib/game/types';
import type { Difficulty, GameMode, Opponent, Settings } from '@/lib/game/types';

type Props = {
  settings: Settings;
  onSubmit: (settings: Settings) => void;
  onCancel?: () => void;
};

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const OPPONENTS: { value: Opponent; label: string }[] = [
  { value: 'ai', label: 'Computer' },
  { value: 'human', label: 'Two players' },
];
const MAX_NAME = 16;

export default function SettingsForm({ settings, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<Settings>(() => normalizeSettings(settings));
  const config = MODES[draft.mode];

  // Changing mode re-clamps size/winLength to values the mode supports.
  const update = (patch: Partial<Settings>) =>
    setDraft((prev) => normalizeSettings({ ...prev, ...patch }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(
      normalizeSettings({
        ...draft,
        playerXName: draft.playerXName.trim() || 'You',
        playerOName: draft.playerOName.trim() || 'Rival',
      }),
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-md">
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold mb-1">Mode</legend>
        {(Object.keys(MODES) as GameMode[]).map((mode) => (
          <label key={mode} className="flex items-start gap-2">
            <input
              type="radio"
              name="mode"
              value={mode}
              checked={draft.mode === mode}
              onChange={() => update({ mode })}
            />
            <span>
              <span className="font-medium">{MODES[mode].label}</span>
              <span className="block text-sm opacity-70">{MODES[mode].tagline}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {config.sizes.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Board size</span>
          <select
            value={draft.size}
            onChange={(e) => update({ size: Number(e.target.value) })}
          >
            {config.sizes.map((size) => (
              <option key={size} value={size}>
                {size} x {size}
              </option>
            ))}
          </select>
        </label>
      )}

      {config.winLengths(draft.size).length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Marks in a row to win</span>
          <select
            value={draft.winLength}
            onChange={(e) => update({ winLength: Number(e.target.value) })}
          >
            {config.winLengths(draft.size).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      {config.timed && (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Seconds per move</span>
          <select
            value={draft.turnSeconds}
            onChange={(e) => update({ turnSeconds: Number(e.target.value) })}
          >
            {TURN_SECONDS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold mb-1">Opponent</legend>
        {OPPONENTS.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="opponent"
              value={value}
              checked={draft.opponent === value}
              onChange={() => update({ opponent: value })}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {draft.opponent === 'ai' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-semibold mb-1">Difficulty</legend>
          {DIFFICULTIES.map((d) => (
            <label key={d} className="flex items-center gap-2 capitalize">
              <input
                type="radio"
                name="difficulty"
                value={d}
                checked={draft.difficulty === d}
                onChange={() => update({ difficulty: d })}
              />
              {d}
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold mb-1">Players</legend>
        <label className="flex flex-col gap-1">
          <span>Player X</span>
          <input
            type="text"
            maxLength={MAX_NAME}
            value={draft.playerXName}
            onChange={(e) => update({ playerXName: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Player O</span>
          <input
            type="text"
            maxLength={MAX_NAME}
            value={draft.playerOName}
            onChange={(e) => update({ playerOName: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </label>
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" className="border rounded px-4 py-2 font-semibold">
          Start game
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="border rounded px-4 py-2">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
