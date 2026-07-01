/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * Determinism is a requirement of the synthetic-data pipeline: with a fixed
 * seed, every regeneration of the dataset produces byte-identical JSON. This
 * makes committed data reviewable via `git diff` when the shape of a
 * generator changes.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, max) — max exclusive. */
  int(min: number, max: number): number;
  /** Random element of a non-empty array. */
  pick<T>(arr: readonly T[]): T;
  /** Fisher-Yates shuffle, in place, returning the input array. */
  shuffle<T>(arr: T[]): T[];
  /** True with probability p. */
  chance(p: number): boolean;
  /** Fresh RNG derived from this one (for sub-scoped determinism). */
  fork(): Rng;
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min)) + min;
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('pick from empty array');
      const item = arr[Math.floor(next() * arr.length)];
      if (item === undefined) throw new Error('unreachable');
      return item;
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const ai = arr[i];
        const aj = arr[j];
        if (ai === undefined || aj === undefined) throw new Error('unreachable');
        arr[i] = aj;
        arr[j] = ai;
      }
      return arr;
    },
    chance(p) {
      return next() < p;
    },
    fork() {
      return makeRng(Math.floor(next() * 0xffffffff));
    },
  };
}
