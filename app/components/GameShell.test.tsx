// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react/ssr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameShell } from './GameShell';

/*
 * The whole screen, wired to the real hook, engine and localStorage. Cells and
 * buttons are clicked the way a user would; the PDS wrappers keep the click
 * handlers and slotted text in the light DOM, which is what is asserted on.
 */

const lightText = (element: Element): string =>
  Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join('');

const cells = () => Array.from(document.querySelectorAll<HTMLElement>('p-button.board__cell'));
const marks = () => Array.from(document.querySelectorAll('.board__mark'), (mark) => mark.textContent);
const hostOf = (text: string | RegExp) =>
  screen.getByText(text).closest('p-button, p-button-pure') as HTMLElement;
const status = () => lightText(document.querySelector('.status p-tag')!);

const mountShell = () => {
  render(
    <PorscheDesignSystemProvider>
      <GameShell />
    </PorscheDesignSystemProvider>
  );
};

const play = (...indices: number[]) => {
  for (const index of indices) fireEvent.click(cells()[index]);
};

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GameShell', () => {
  it('plays a two-player game to a win and records it', () => {
    window.localStorage.setItem(
      'ttt-lab:settings',
      JSON.stringify({ opponent: 'human', playerXName: 'Ann', playerOName: 'Bob' })
    );
    mountShell();
    expect(status()).toBe('Ann to move');

    play(0, 3, 1, 4, 2);

    expect(marks().slice(0, 6)).toEqual(['X', 'X', 'X', 'O', 'O', ' ']);
    expect(status()).toBe('Winner: Ann · 3 in a row');
    // Screen readers hear the last move and the result.
    expect(lightText(screen.getByRole('status'))).toBe('Ann played C1. Winner: Ann · 3 in a row.');
    // The finished board is no longer a set of buttons; the winning line is marked.
    expect(cells()).toHaveLength(0);
    expect(document.querySelectorAll('.board__cell--static[data-won="true"]')).toHaveLength(3);
    expect(screen.getByLabelText('Row 1, column 1, X, winning line')).toBeTruthy();
    // The score names marks, not today's player names.
    expect(lightText(document.querySelector('.scoreboard__entry p-text:last-child')!)).toBe('X wins');
    expect(document.querySelectorAll('p-table-row')).not.toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem('ttt-lab:stats')!).scoreboard).toEqual({ X: 1, O: 0, draws: 0 });
    // The statistics panel appears with the first stored game.
    expect(screen.getByText('Statistics')).toBeTruthy();
  });

  it('shows a hint on the board and clears it after the move', () => {
    window.localStorage.setItem('ttt-lab:settings', JSON.stringify({ opponent: 'human' }));
    mountShell();
    play(0, 3, 1, 4);

    fireEvent.click(hostOf('Show a hint'));
    expect(document.querySelectorAll('[data-hint="true"]')).toHaveLength(1);
    expect(cells()[2].querySelector('[data-hint="true"]')).not.toBeNull();

    play(8);
    expect(document.querySelectorAll('[data-hint="true"]')).toHaveLength(0);
  });

  it('opens the replay of a stored game and closes it again', () => {
    window.localStorage.setItem('ttt-lab:settings', JSON.stringify({ opponent: 'human' }));
    mountShell();
    play(0, 3, 1, 4, 2);

    fireEvent.click(hostOf(/Replay the game played at/));
    expect(screen.getByText(/^Replay · Classic 3x3/)).toBeTruthy();
    expect(document.querySelectorAll('.replay__board .board__cell--static')).toHaveLength(9);

    fireEvent.click(hostOf('Close'));
    expect(document.querySelector('.replay__board')).toBeNull();
  });

  it('lets the computer reply and rewinds to your own move', () => {
    mountShell(); // defaults: against the computer
    play(4);
    expect(screen.getByText('Thinking…')).toBeTruthy();

    act(() => vi.advanceTimersByTime(1_000));
    expect(marks().filter((mark) => mark === 'O')).toHaveLength(1);

    fireEvent.click(hostOf('Back to the empty board'));
    expect(marks().every((mark) => mark === ' ')).toBe(true);
  });

  it('clears the history, the score and the statistics', () => {
    window.localStorage.setItem('ttt-lab:settings', JSON.stringify({ opponent: 'human' }));
    mountShell();
    play(0, 3, 1, 4, 2);
    fireEvent.click(hostOf('Clear history'));

    expect(document.querySelectorAll('p-table-row')).toHaveLength(0);
    expect(screen.queryByText('Statistics')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('ttt-lab:stats')!).history).toEqual([]);
  });

  it('announces every move for screen readers', () => {
    window.localStorage.setItem('ttt-lab:settings', JSON.stringify({ opponent: 'human', playerOName: 'Bob' }));
    mountShell();
    expect(lightText(screen.getByRole('status'))).toBe('You to move.');
    play(4);
    expect(lightText(screen.getByRole('status'))).toBe('You played B2. Bob to move.');
  });

  it('shows the moves without rewind buttons in Blitz', () => {
    window.localStorage.setItem('ttt-lab:settings', JSON.stringify({ opponent: 'human', mode: 'blitz' }));
    mountShell();
    expect(screen.getByText('Clock starts after the first move')).toBeTruthy();
    play(4);
    expect(screen.getByText('Rewinding is off in Blitz — it would reset the clock.')).toBeTruthy();
    expect(screen.getByText('1. X → B2')).toBeTruthy();
    expect(screen.queryByText('Back to the empty board')).toBeNull();
  });

  it('survives a corrupted localStorage on first render', () => {
    window.localStorage.setItem('ttt-lab:history', JSON.stringify([{ id: 'x', mode: 'chess' }]));
    window.localStorage.setItem('ttt-lab:settings', '{"mode":"foo"');
    mountShell();
    expect(cells()).toHaveLength(9);
    expect(status()).toBe('You to move');
  });
});
