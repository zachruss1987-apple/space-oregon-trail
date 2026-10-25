/** docs/design/travel.md "Repairs" and "Scan for salvage", plus passing help (step 3). */
import { describe, expect, it } from 'vitest';
import { applyAction, canScan, createRng, intentBlocker, rationNeed, repairChance, tick, type GameState } from '@/sim';
import { CONTINUE, expectRate, quietTick, runTrials, ship, withCrew } from './spec-helpers';

const broken = (hull: boolean, pump: boolean, gyro: boolean) => ({ hull, pump, gyro });
const injury = { id: 'decompression-injury' as const, remaining: 15, daysActive: 0 };

describe('Passing help (travel.md step 3)', () => {
  it('a broken part with no spare is fixed by passing help 10% of days', () => {
    const s = ship({ broken: broken(false, true, false), supplies: { pumps: 0 } });
    const n = 3000;
    let fixed = 0;
    for (let seed = 1; seed <= n; seed++) if (tick(s, createRng(seed)).entries.some((e) => e.kind === 'help')) fixed++;
    expectRate(fixed, n, 0.1, 4, 'passing help');
  });

  it('help fixes pump first, then hull plate, then gyro', () => {
    let s = ship({ broken: broken(true, true, true), supplies: { plates: 0, pumps: 0, gyros: 0 } });
    const order: string[] = [];
    for (let seed = 1; seed < 4000 && order.length < 3; seed++) {
      const r = tick(s, createRng(seed));
      if (!r.entries.some((e) => e.kind === 'help')) continue;
      const now = r.state.broken;
      if (!now.pump && s.broken.pump) order.push('pump');
      else if (!now.hull && s.broken.hull) order.push('hull');
      else if (!now.gyro && s.broken.gyro) order.push('gyro');
      s = { ...r.state, status: 'traveling' };
    }
    expect(order).toEqual(['pump', 'hull', 'gyro']);
  });

  it('help fixes only one broken part per day', () => {
    const s = ship({ broken: broken(true, true, true), supplies: { plates: 0, pumps: 0, gyros: 0 } });
    for (let seed = 1; seed <= 600; seed++) {
      const r = tick(s, createRng(seed));
      if (!r.entries.some((e) => e.kind === 'help')) continue;
      expect(Object.values(r.state.broken).filter((b) => !b).length).toBe(1);
    }
  });

  it('no help for a broken part that has a matching spare', () => {
    const s = ship({ broken: broken(false, true, false), supplies: { pumps: 1 } });
    for (let seed = 1; seed <= 600; seed++) expect(tick(s, createRng(seed)).entries.some((e) => e.kind === 'help')).toBe(false);
  });

  it('a stranded ship (0 drives) gets 1 drive from a passing hauler 10% of days, else strandedDays +1', () => {
    const s = ship({ supplies: { drives: 0 } });
    const n = 3000;
    let gifted = 0;
    for (let seed = 1; seed <= n; seed++) {
      const res = tick(s, createRng(seed));
      const r = res.state;
      if (res.entries.some((e) => e.kind === 'help')) {
        gifted++;
        expect(r.strandedDays).toBe(0); // (a same-day drive_failure may take the gift away again)
      } else {
        expect(r.strandedDays).toBe(1);
      }
    }
    expectRate(gifted, n, 0.1, 4, 'hauler');
  });

  it('adrift: 0 drives and strandedDays reaching 15 ends the run', () => {
    const t = runTrials(ship({ supplies: { drives: 0 }, strandedDays: 14 }), CONTINUE, 100, (x) => x.r.state.supplies.drives === 0)[0]!;
    expect(t.r.state.strandedDays).toBe(15);
    expect(t.r.state.status).toBe('adrift');
  });

  it('adrift is not declared at 14 stranded days', () => {
    const t = runTrials(ship({ supplies: { drives: 0 }, strandedDays: 13 }), CONTINUE, 100, (x) => x.r.state.supplies.drives === 0)[0]!;
    expect(t.r.state.strandedDays).toBe(14);
    expect(t.r.state.status).toBe('traveling');
  });

  it('gaining a drive resets the stranded counter', () => {
    const t = runTrials(ship({ supplies: { drives: 0 }, strandedDays: 9 }), CONTINUE, 400, (x) => x.r.state.supplies.drives === 1 && x.r.state.status === 'traveling')[0]!;
    expect(t.r.state.strandedDays).toBe(0);
  });
});

describe('Repairs (travel.md "Repairs")', () => {
  const pumpDown = (profession: 'executive' | 'engineer', extra: Partial<GameState> = {}): GameState =>
    ship({ broken: broken(false, true, false), supplies: { pumps: 1 }, ...extra }, profession);

  it('without a spare the option does nothing: "No spare." and no day passes', () => {
    const s = ship({ broken: broken(false, true, false), supplies: { pumps: 0 } });
    const r = applyAction(s, { type: 'repair', part: 'pump' }, createRng(1));
    expect(r.error).toBe('No spare.');
    expect(r.state).toBe(s);
    expect(r.state.day).toBe(0);
  });

  it('repair is refused when nothing is broken', () => {
    const r = applyAction(ship(), { type: 'repair', part: 'hull' }, createRng(1));
    expect(r.error).toBeTruthy();
    expect(r.state.day).toBe(0);
  });

  it('Attempt repair takes 1 day and moves 0 Mk', () => {
    const { r } = quietTick(pumpDown('executive'), { type: 'repair', part: 'pump' });
    expect(r.state.day).toBe(1);
    expect(r.state.distanceInSegment).toBe(0);
  });

  it('repairChance: 80% default, 95% Ship Engineer, minus 10 points with a decompression injury', () => {
    expect(repairChance(ship())).toBeCloseTo(0.8, 9);
    expect(repairChance(ship({}, 'farmer'))).toBeCloseTo(0.8, 9);
    expect(repairChance(ship({}, 'engineer'))).toBeCloseTo(0.95, 9);
    expect(repairChance(withCrew(ship(), 2, { conditions: [injury] }))).toBeCloseTo(0.7, 9);
    expect(repairChance(withCrew(ship({}, 'engineer'), 2, { conditions: [injury] }))).toBeCloseTo(0.85, 9);
  });

  it('a decompression injury on an absent (drifting) crew member does not count', () => {
    expect(repairChance(withCrew(ship(), 1, { awayDays: 2, conditions: [injury] }))).toBeCloseTo(0.8, 9);
  });

  const stats = (s: GameState, n: number) => {
    const trials = runTrials(s, { type: 'repair', part: 'pump' }, n, (t) => !t.r.entries.some((e) => e.kind === 'event'));
    let ok = 0;
    let fails = 0;
    let failSpareLost = 0;
    for (const { r } of trials) {
      if (!r.state.broken.pump) {
        ok++;
        expect(r.state.supplies.pumps).toBe(0);
      } else {
        fails++;
        if (r.state.supplies.pumps === 0) failSpareLost++;
      }
    }
    return { n: trials.length, ok, fails, failSpareLost };
  };

  it('success 80% (default); the spare is consumed on success', () => {
    const r = stats(pumpDown('executive'), 4000);
    expectRate(r.ok, r.n, 0.8, 4, 'repair success');
  });

  it('spare consumed on failure 30% (default)', () => {
    const r = stats(pumpDown('executive'), 8000);
    expectRate(r.failSpareLost, r.fails, 0.3, 4, 'failure spare loss');
  });

  it('Ship Engineer: success 95%', () => {
    const r = stats(pumpDown('engineer'), 4000);
    expectRate(r.ok, r.n, 0.95, 4, 'engineer repair success');
  });

  it('Ship Engineer: spare consumed on failure 10%', () => {
    const r = stats(pumpDown('engineer'), 14000);
    expect(r.fails).toBeGreaterThan(300);
    expectRate(r.failSpareLost, r.fails, 0.1, 4, 'engineer failure spare loss');
  });

  it('a decompression injury lowers repair success by 10 points (70% default)', () => {
    const r = stats(withCrew(pumpDown('executive'), 1, { conditions: [injury] }), 4000);
    expectRate(r.ok, r.n, 0.7, 4, 'injured repair success');
  });
});

describe('Scan for salvage (travel.md "Scan for salvage")', () => {
  const gains = (s: GameState, n: number): number[] =>
    runTrials(s, { type: 'scan' }, n).map((t) => t.r.state.supplies.rations - (s.supplies.rations - rationNeed(s)));
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('needs 5 drone charges: with 4 the scan is refused', () => {
    const s = ship({ supplies: { charges: 4 } });
    expect(canScan(s)).toBe(false);
    expect(applyAction(s, { type: 'scan' }, createRng(1)).error).toBeTruthy();
    expect(canScan(ship({ supplies: { charges: 5 } }))).toBe(true);
  });

  it('not available at New Willamette', () => {
    expect(intentBlocker(ship({ arrivedAt: 16, segment: 16 }), { type: 'scan' })).toBeTruthy();
  });

  it('takes 1 day, consumes exactly 5 charges, covers 0 Mk', () => {
    const { r } = quietTick(ship({ supplies: { charges: 23 } }), { type: 'scan' });
    expect(r.state.supplies.charges).toBe(18);
    expect(r.state.day).toBe(1);
    expect(r.state.distanceInSegment).toBe(0);
  });

  it('yields: nothing / 15-40 / 40-80 rations; never more than 80', () => {
    const g = gains(ship(), 1500);
    expect(Math.max(...g)).toBeLessThanOrEqual(80);
    for (const x of g) expect(x === 0 || (x >= 15 && x <= 80)).toBe(true);
    expect(g.some((x) => x >= 15 && x < 40)).toBe(true);
    expect(g.some((x) => x > 40)).toBe(true);
  });

  it('expected first-scan yield is about 27 rations', () => {
    const m = mean(gains(ship(), 3000));
    expect(m).toBeGreaterThan(25);
    expect(m).toBeLessThan(29.5);
  });

  it('25% of scans find nothing (spares at cap: the 5% spare case yields rations instead)', () => {
    const g = gains(ship({ supplies: { plates: 3, pumps: 3, gyros: 3 } }), 4000);
    expectRate(g.filter((x) => x === 0).length, g.length, 0.25, 4, 'empty scans');
  });

  it('about 5% of scans return one random spare part instead of rations (spares below cap)', () => {
    const trials = runTrials(ship({ supplies: { plates: 0, pumps: 0, gyros: 0 } }), { type: 'scan' }, 4000);
    const parts = trials.filter((t) => t.r.state.supplies.plates + t.r.state.supplies.pumps + t.r.state.supplies.gyros === 1).length;
    expectRate(parts, trials.length, 0.05, 4, 'spare finds');
  });

  it('the 3rd and later scans in a segment halve ration yields (floor): mean ~13', () => {
    const g = gains(ship({ scansThisSegment: 2 }), 3000);
    expect(mean(g)).toBeGreaterThan(11.5);
    expect(mean(g)).toBeLessThan(15);
    expect(Math.max(...g)).toBeLessThanOrEqual(40);
  });

  it('the 2nd scan in a segment is not yet halved', () => {
    expect(Math.max(...gains(ship({ scansThisSegment: 1 }), 2000))).toBeGreaterThan(40);
  });
});
