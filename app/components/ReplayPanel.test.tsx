// @vitest-environment jsdom
import { act, cleanup, fireEvent, render as renderRaw, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react/ssr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REPLAY_STEP_MS, ReplayPanel } from './ReplayPanel';
import type { MatchRecord } from '@/lib/game/types';

/*
 * Rendered with the real PDS React wrappers. jsdom does not upgrade the web
 * components, but slotted text and click handlers live in the light DOM, which
 * is exactly what the replay logic drives.
 */

const record: MatchRecord = {
  id: 'game-1',
  playedAt: '2026-09-06T10:00:00.000Z',
  mode: 'vanishing',
  opponent: 'human',
  difficulty: null,
  size: 3,
  winLength: 3,
  players: { X: 'Ann', O: 'Bob' },
  result: 'X',
  reason: 'line',
  moveCount: 9,
  durationMs: 30_000,
  moves: [0, 3, 1, 4, 8, 6, 5, 7, 2],
};

const render = (ui: ReactElement) =>
  renderRaw(ui, { wrapper: ({ children }) => <PorscheDesignSystemProvider>{children}</PorscheDesignSystemProvider> });

const button = (name: string) => screen.getByText(name).closest('p-button') as HTMLElement;
/** Own text of an element — the SSR wrappers also inline their shadow styles. */
const lightText = (element: Element): string =>
  Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join('');
const caption = () => lightText(screen.getByText(/move \d+ of 9/));
const marks = () =>
  Array.from(document.querySelectorAll('.board__mark'), (mark) => mark.getAttribute('data-mark'));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ReplayPanel', () => {
  it('opens on the final position with the winner named', () => {
    render(<ReplayPanel record={record} onClose={() => {}} />);
    expect(screen.getByText(/Replay · Vanishing 3x3 · Ann won/)).toBeTruthy();
    expect(caption()).toBe('9. X → C1 (B1 vanished) · move 9 of 9');
    expect(document.querySelectorAll('[data-won="true"].board__cell--static')).toHaveLength(3);
  });

  it('steps back and forth through the moves, including vanished marks', () => {
    render(<ReplayPanel record={record} onClose={() => {}} />);
    fireEvent.click(button('First position'));
    expect(caption()).toBe('Empty board · move 0 of 9');
    expect(marks().every((mark) => mark === 'empty')).toBe(true);

    fireEvent.click(button('Final position'));
    fireEvent.click(button('Previous move'));
    expect(caption()).toBe('8. O → B3 (A2 vanished) · move 8 of 9');
    // A1 vanished on move 7 and B1 is still on the board.
    expect(marks()[0]).toBe('empty');
    expect(marks()[1]).toBe('X');
  });

  it('plays the game back automatically from the start and stops at the end', () => {
    render(<ReplayPanel record={record} onClose={() => {}} />);
    fireEvent.click(button('Play'));
    expect(caption()).toBe('Empty board · move 0 of 9');

    act(() => vi.advanceTimersByTime(REPLAY_STEP_MS * 3));
    expect(caption()).toMatch(/move 3 of 9$/);

    act(() => vi.advanceTimersByTime(REPLAY_STEP_MS * 20));
    expect(caption()).toMatch(/move 9 of 9$/);
    expect(screen.getByText('Play')).toBeTruthy();
  });

  it('explains when a record has no stored moves', () => {
    const onClose = vi.fn();
    render(<ReplayPanel record={{ ...record, moves: null }} onClose={onClose} />);
    expect(document.querySelector('p-inline-notification')).not.toBeNull();
    expect(document.querySelector('.board')).toBeNull();
    fireEvent.click(screen.getByText('Close replay'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
