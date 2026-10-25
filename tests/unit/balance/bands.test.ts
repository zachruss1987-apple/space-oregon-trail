import { describe, expect, it } from 'vitest';
import { pool, runMatrix } from '@/sim/balance';

// baseline 2026-10-25; M5 tuning will move these toward the targets in M5.md
const BASELINE = { winRate: 0.392, meanDays: 180.8 };

describe('balance bands (reduced matrix, reference policy)', () => {
  const cells = runMatrix({ seeds: 60, policies: ['balanced'], windows: [2, 4] });
  const all = pool(cells);
  it('has no NaN', () => {
    for (const c of cells) for (const v of [c.winRate, c.meanDays, c.medianDays, c.meanCredits, c.score.p10, c.score.p50, c.score.p90]) expect(Number.isNaN(v)).toBe(false);
  });
  it('overall win rate is within 12 points of the baseline', () => {
    expect(Math.abs(all.winRate - BASELINE.winRate)).toBeLessThanOrEqual(0.12);
  });
  it('mean days is within 25 of the baseline', () => {
    expect(Math.abs(all.meanDays - BASELINE.meanDays)).toBeLessThanOrEqual(25);
  });
});
