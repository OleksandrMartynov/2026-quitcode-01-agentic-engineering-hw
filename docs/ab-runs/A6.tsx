'use client';

import { useState } from 'react';
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
  const [draft, setDraft] = useState<Settings>(settings);
  const config = MODES[draft.mode];

  // Every change goes through normalize so size/winLength always fit the mode.
  const update = (patch: Partial<Settings>) =>
    setDraft((prev) => normalizeSettings({ ...prev, ...patch }));

  const winLengths = config.winLengths(draft.size);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...draft,
      playerXName: draft.playerXName.trim() || settings.playerXName,
      playerOName: draft.playerOName.trim() || settings.playerOName,
    });
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
              className="mt-1"
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
            className="border rounded px-2 py-1"
          >
            {config.sizes.map((size) => (
              <option key={size} value={size}>
                {size} x {size}
              </option>
            ))}
          </select>
        </label>
      )}

      {winLengths.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Marks in a row to win</span>
          <select
            value={draft.winLength}
            onChange={(e) => update({ winLength: Number(e.target.value) })}
            className="border rounded px-2 py-1"
          >
            {winLengths.map((length) => (
              <option key={length} value={length}>
                {length}
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
            className="border rounded px-2 py-1"
          >
            {TURN_SECONDS_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} s
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
          <div className="flex gap-4">
            {DIFFICULTIES.map((level) => (
              <label key={level} className="flex items-center gap-2 capitalize">
                <input
                  type="radio"
                  name="difficulty"
                  value={level}
                  checked={draft.difficulty === level}
                  onChange={() => update({ difficulty: level })}
                />
                {level}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold mb-1">Players</legend>
        <label className="flex flex-col gap-1">
          <span>Player X</span>
          <input
            type="text"
            value={draft.playerXName}
            maxLength={MAX_NAME}
            onChange={(e) => update({ playerXName: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Player O</span>
          <input
            type="text"
            value={draft.playerOName}
            maxLength={MAX_NAME}
            onChange={(e) => update({ playerOName: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </label>
      </fieldset>

      <div className="flex gap-3">
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
