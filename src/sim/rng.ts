/**
 * Deterministic seeded PRNG (mulberry32). The whole simulation must draw its
 * randomness from here so that runs are reproducible in tests and balance sims.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** True with the given probability (0..1). */
  chance(p: number): boolean;
  /** Pick a uniformly random element. Throws on empty arrays. */
  pick<T>(items: readonly T[]): T;
  /** Weighted pick; weights need not sum to 1. */
  weighted<T>(items: readonly { item: T; weight: number }[]): T;
}

export function createRng(seed: number): Rng {
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
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick() on empty array');
      return items[Math.floor(next() * items.length)] as T;
    },
    weighted<T>(items: readonly { item: T; weight: number }[]): T {
      const total = items.reduce((sum, { weight }) => sum + weight, 0);
      if (total <= 0) throw new Error('weighted() needs positive total weight');
      let roll = next() * total;
      for (const { item, weight } of items) {
        roll -= weight;
        if (roll < 0) return item;
      }
      return (items[items.length - 1] as { item: T }).item;
    },
  };
}

/** Hash a string into a 32-bit seed so players can share seeds like "DYSENTERY". */
export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
