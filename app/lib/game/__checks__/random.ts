/**
 * Deterministic PRNG (mulberry32) for the checks: every random game in the
 * suite is reproducible from its seed, so a failure can be replayed exactly.
 */
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = <T,>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)];
