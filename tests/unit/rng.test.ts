import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from '@/sim/rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('int() stays within inclusive bounds', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('chance() approximates its probability', () => {
    const rng = createRng(99);
    let hits = 0;
    for (let i = 0; i < 10_000; i++) if (rng.chance(0.3)) hits++;
    expect(hits / 10_000).toBeCloseTo(0.3, 1);
  });

  it('weighted() respects weights', () => {
    const rng = createRng(5);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++) {
      counts[rng.weighted([{ item: 'a' as const, weight: 9 }, { item: 'b' as const, weight: 1 }])]++;
    }
    expect(counts.a / 10_000).toBeCloseTo(0.9, 1);
  });

  it('pick() throws on empty input', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });
});

describe('seedFromString', () => {
  it('is stable and distinguishes strings', () => {
    expect(seedFromString('DYSENTERY')).toBe(seedFromString('DYSENTERY'));
    expect(seedFromString('DYSENTERY')).not.toBe(seedFromString('CHOLERA'));
  });
});
