import { describe, expect, it } from 'vitest';
import { createRng } from '@/sim/rng';

describe('rng distribution', () => {
  it('next() is roughly uniform across 10 buckets', () => {
    const rng = createRng(2024);
    const N = 20_000;
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < N; i++) buckets[Math.floor(rng.next() * 10)]!++;
    const expected = N / 10;
    for (const count of buckets) {
      expect(count).toBeGreaterThanOrEqual(expected * 0.85);
      expect(count).toBeLessThanOrEqual(expected * 1.15);
    }
  });

  it('int(0, 9) hits every value', () => {
    const rng = createRng(77);
    const seen = new Set<number>();
    for (let i = 0; i < 20_000; i++) seen.add(rng.int(0, 9));
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
