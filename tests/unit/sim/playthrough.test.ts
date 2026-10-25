/**
 * M1 balance smoke (docs/milestones/M1.md): 200 seeded runs with the reference policy from the end of
 * docs/design/travel.md. Band: overall win rate 25–60%, mean days 120–200.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { ProfessionId } from '@/content';
import { runPolicy, type RunSummary } from '@/sim/policy';

const RUNS = 200;

function summarize(runs: RunSummary[]) {
  const wins = runs.filter((r) => r.status === 'arrived').length;
  const meanDays = runs.reduce((s, r) => s + r.days, 0) / runs.length;
  return { n: runs.length, winRate: wins / runs.length, meanDays };
}

describe.skipIf(process.env.SKIP_SLOW)('playthrough (reference policy)', () => {
  let runs: RunSummary[] = [];
  beforeAll(() => {
    runs = Array.from({ length: RUNS }, (_, i) => runPolicy(i + 1));
  }, 30000);

  it('win rate is within 25–60% and mean days within 120–200', () => {
    const all = summarize(runs);
    expect(all.winRate).toBeGreaterThanOrEqual(0.25);
    expect(all.winRate).toBeLessThanOrEqual(0.6);
    expect(all.meanDays).toBeGreaterThanOrEqual(120);
    expect(all.meanDays).toBeLessThanOrEqual(200);
  });

  it('profession ordering matches the design: Executive and Engineer far ahead of Farmer', () => {
    const by = (p: ProfessionId) => summarize(runs.filter((r) => r.profession === p));
    expect(by('executive').winRate).toBeGreaterThan(by('farmer').winRate);
    expect(by('engineer').winRate).toBeGreaterThan(by('farmer').winRate);
    expect(by('farmer').winRate).toBeLessThan(0.2);
  });

  it('every run ends, with no NaN or negative values', () => {
    for (const r of runs) {
      expect(['arrived', 'dead', 'adrift']).toContain(r.status);
      expect(Number.isFinite(r.score) && r.score >= 0).toBe(true);
      expect(Object.values(r.final.supplies).every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
      if (r.status === 'arrived') expect(r.score).toBeGreaterThan(0);
    }
  });
});
