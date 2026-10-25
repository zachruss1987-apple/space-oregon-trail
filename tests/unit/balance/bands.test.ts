import { describe, expect, it } from 'vitest';
import type { ProfessionId } from '@/content';
import { pool, runMatrix } from '@/sim/balance';

// Tuned on T-039 (decisions.md 2026-10-25; docs/reports/balance-tuned.md). Measured with this exact matrix
// (balanced policy, seeds 1..100, all five windows): Executive 62.6%, Engineer 50.4%, Farmer 30.6%, mean 170.4 days,
// top death cause 30.6% (radiation sickness); Greenhorn 78.5%, Spacer 47.9%, Pathfinder 20.9%.
// The assertions are the M5 target bands, not a tolerance around those numbers.
const MEASURED = { executive: 0.626, engineer: 0.504, farmer: 0.306, meanDays: 170.4, greenhorn: 0.785, spacer: 0.479, pathfinder: 0.209 };
const BANDS: Record<ProfessionId, [number, number]> = { executive: [0.55, 0.65], engineer: [0.45, 0.6], farmer: [0.25, 0.35] };
const DAYS: [number, number] = [140, 175];
const MAX_CAUSE_SHARE = 0.35;
const DIFFICULTY_GAP = 0.15;
const SEEDS = 100;

describe('balance bands (M5 targets, reference policy, all windows)', () => {
  const cells = runMatrix({ seeds: SEEDS, policies: ['balanced'] });
  const all = pool(cells);

  it('has no NaN', () => {
    for (const c of cells) for (const v of [c.winRate, c.meanDays, c.medianDays, c.meanCredits, c.score.p10, c.score.p50, c.score.p90]) expect(Number.isNaN(v)).toBe(false);
  });

  it.each(Object.entries(BANDS) as [ProfessionId, [number, number]][])('%s win rate is inside its M5 band', (p, [lo, hi]) => {
    const w = pool(cells.filter((c) => c.profession === p)).winRate;
    expect(w, `${p} measured ${MEASURED[p]}`).toBeGreaterThanOrEqual(lo);
    expect(w).toBeLessThanOrEqual(hi);
  });

  it('Farmer is the hardest and Executive the easiest', () => {
    const w = (p: ProfessionId): number => pool(cells.filter((c) => c.profession === p)).winRate;
    expect(w('farmer')).toBeLessThan(w('engineer'));
    expect(w('engineer')).toBeLessThan(w('executive'));
  });

  it('mean run length is inside the target band', () => {
    expect(all.meanDays, `measured ${MEASURED.meanDays}`).toBeGreaterThanOrEqual(DAYS[0]);
    expect(all.meanDays).toBeLessThanOrEqual(DAYS[1]);
  });

  it('no single death cause exceeds 35% of crew deaths', () => {
    const total = Object.values(all.causes).reduce((a, b) => a + b, 0);
    for (const [cause, n] of Object.entries(all.causes)) expect(n / total, cause).toBeLessThanOrEqual(MAX_CAUSE_SHARE);
  });

  it('difficulty keeps its ordering: Greenhorn >= Spacer + 15 points, Pathfinder <= Spacer - 15 points', () => {
    const g = pool(runMatrix({ seeds: SEEDS, policies: ['balanced'], difficulty: 'greenhorn' })).winRate;
    const p = pool(runMatrix({ seeds: SEEDS, policies: ['balanced'], difficulty: 'pathfinder' })).winRate;
    expect(g - all.winRate, `measured ${MEASURED.greenhorn} vs ${MEASURED.spacer}`).toBeGreaterThanOrEqual(DIFFICULTY_GAP);
    expect(all.winRate - p, `measured ${MEASURED.pathfinder}`).toBeGreaterThanOrEqual(DIFFICULTY_GAP);
  }, 60_000);
});
