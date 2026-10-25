/** hazards.md: availability, incident formula, severity modifiers, tug and pilot rules, risk words, determinism. */
import { describe, expect, it } from 'vitest';
import { applyAction, createRng, crossingOptions, riskWord, type CrossMethod, type GameState, type LogEntry, type WindowId } from '@/sim';
import { daysBetween, expectRate, ship } from './spec-helpers';

/** trail.md hazard parameters, typed from the doc: index -> baseline %, nominal density, tug price, pilot wait. */
const H: Record<number, { name: string; base: number; nominal: number; tug: number; wait: number | null }> = {
  1: { name: 'Lunar Debris Ring', base: 15, nominal: 2, tug: 25, wait: null },
  2: { name: 'Lagrange Shoals', base: 15, nominal: 2, tug: 35, wait: null },
  7: { name: 'The Belt Crossing', base: 35, nominal: 4, tug: 80, wait: 4 },
  9: { name: 'Saturn Ring Plane', base: 25, nominal: 3, tug: 60, wait: 3 },
  13: { name: 'Proxima Heliopause Shock', base: 35, nominal: 4, tug: 90, wait: null },
  15: { name: 'The Flare Belt', base: 45, nominal: 5, tug: 120, wait: null },
};
const HAZ = [1, 2, 7, 9, 13, 15];
const FLARE_DATE = '2184-09-20';
const rhu = (x: number): number => Math.floor(x + 0.5 + 1e-9);

type Over = Parameters<typeof ship>[0];
function pending(idx: number, density: number, over: Over = {}, window: WindowId = 3): GameState {
  return ship({
    arrivedAt: idx, segment: idx, date: '2184-07-01', credits: 500, rations: 'half',
    crossing: { waypoint: idx, density, pilotDaysLeft: null },
    ...over,
    supplies: { drives: 3, rations: 1500, suits: 20, charges: 200, plates: 3, pumps: 3, gyros: 3, ...over?.supplies },
  }, 'executive', window);
}
const opt = (s: GameState, m: CrossMethod) => crossingOptions(s).find((o) => o.method === m)!;
const cross = (s: GameState, method: CrossMethod, seed: number) => applyAction(s, { type: 'cross', method }, createRng(seed));
const outcomeOf = (es: readonly LogEntry[]): string | undefined => es.find((e) => e.kind === 'hazard' && e.id !== 'pump-strain')?.id;
const OUT = ['clear', 'scraped', 'cargo', 'damage', 'injury', 'lost'];

/** Outcome counts of `method` over seeds 1..n (resolved crossings only). */
function tally(s: GameState, method: CrossMethod, n: number): { counts: Record<string, number>; pump: number; total: number } {
  const counts: Record<string, number> = Object.fromEntries(OUT.map((o) => [o, 0]));
  let pump = 0;
  let total = 0;
  for (let seed = 1; seed <= n; seed++) {
    const r = cross(s, method, seed);
    const o = outcomeOf(r.entries);
    if (!o || r.state.crossing) continue;
    counts[o]!++;
    total++;
    if (r.entries.some((e) => e.id === 'pump-strain')) pump++;
  }
  return { counts, pump, total };
}

describe('availability matrix (hazards.md "Availability")', () => {
  for (const idx of HAZ) {
    const h = H[idx]!;
    it(`${h.name}: thread, shields, tug, pilot offered per the table (intact ship, 500 cr)`, () => {
      const s = pending(idx, h.nominal);
      expect(opt(s, 'thread').blocker).toBeNull();
      expect(opt(s, 'tug').blocker).toBeNull();
      if (idx === 15) {
        expect(opt(s, 'shields').blocker).toBe('Not in this weather.');
        expect(opt(s, 'pilot').blocker).toBe('Not in this weather.');
      } else {
        expect(opt(s, 'shields').blocker).toBeNull();
        expect(opt(s, 'pilot').blocker).toBe(h.wait === null ? 'No Belters work this stretch.' : null);
      }
      expect(opt(s, 'pilot').waitDays).toBe(h.wait ?? undefined);
      expect(opt(s, 'tug').price).toBe(h.tug);
    });

    it(`${h.name}: a ship that cannot move can still hire a tug (and a pilot where offered)`, () => {
      for (const over of [{ supplies: { drives: 0 } }, { broken: { hull: false, pump: true, gyro: false } }] as Over[]) {
        const s = pending(idx, h.nominal, over);
        expect(opt(s, 'thread').blocker).toBe('Your ship cannot move.');
        if (idx !== 15) expect(opt(s, 'shields').blocker).toBe('Your ship cannot move.');
        expect(opt(s, 'tug').blocker).toBeNull();
        if (h.wait !== null) expect(opt(s, 'pilot').blocker).toBeNull();
      }
    });

    it(`${h.name}: credits gate the tug (price) and the pilot (10 cr)`, () => {
      const poor = pending(idx, h.nominal, { credits: h.tug - 0.5 });
      expect(opt(poor, 'tug').blocker).toBe('You cannot afford a tug.');
      expect(pending(idx, h.nominal, { credits: h.tug }).crossing).toBeTruthy();
      expect(opt(pending(idx, h.nominal, { credits: h.tug }), 'tug').blocker).toBeNull();
      if (h.wait !== null) {
        expect(opt(pending(idx, h.nominal, { credits: 9.99 }), 'pilot').blocker).toBe('You cannot afford a pilot.');
        expect(opt(pending(idx, h.nominal, { credits: 10 }), 'pilot').blocker).toBeNull();
      }
    });
  }

  it('a pending crossing refuses continue; rest is allowed', () => {
    const s = pending(7, 4);
    expect(applyAction(s, { type: 'continue' }, createRng(1)).error).toBe('Choose how to cross first.');
    expect(applyAction(s, { type: 'rest', days: 1 }, createRng(1)).error).toBeUndefined();
  });

  it('crossing resolution clears the pending state and leaves the ship parked', () => {
    const r = cross(pending(7, 4), 'tug', 1);
    expect(r.state.crossing).toBeNull();
    expect(r.state.arrivedAt).toBe(7);
    expect(r.state.justCrossedHazard).toBe(true);
    expect(r.entries.map((e) => e.kind).slice(0, 2)).toEqual(['crossing', 'hazard']);
    expect(r.entries[0]!.id).toBe('tug');
  });
});

describe('incident chance formula (hazards.md)', () => {
  const SHIPS: [string, Over, number][] = [
    ['intact', {}, 0],
    ['hull broken', { broken: { hull: true, pump: false, gyro: false } }, 10],
    ['gyro broken', { broken: { hull: false, pump: false, gyro: true } }, 10],
    ['one working drive', { supplies: { drives: 1 } }, 10],
    ['hull + gyro + one drive', { broken: { hull: true, pump: false, gyro: true }, supplies: { drives: 1 } }, 30],
  ];

  for (const idx of [1, 2, 7, 9, 13]) {
    const h = H[idx]!;
    for (let density = 1; density <= 5; density++) {
      it(`Thread at ${h.name}, density ${density}: round(base x factor) + ship, Shields = half`, () => {
        for (const [, over, mod] of SHIPS) {
          for (const w of [1, 2, 3] as WindowId[]) {
            for (const route of ['oort', 'direct'] as const) {
              const s = pending(idx, density, { ...over, route }, w);
              const window = (idx === 1 || idx === 2) ? (w === 1 ? 10 : w === 2 ? 5 : 0) : 0;
              const routeBonus = idx === 13 && route === 'direct' ? 10 : 0;
              const factor = 1 + 0.2 * (density - h.nominal);
              const T = Math.min(95, rhu((h.base + window + routeBonus) * factor) + mod);
              expect(opt(s, 'thread').chance).toBe(T);
              expect(opt(s, 'shields').chance).toBe(rhu(T * 0.5));
              expect(opt(s, 'tug').chance).toBe(0);
              expect(opt(s, 'pilot').chance).toBe(h.wait === null ? null : 3);
            }
          }
        }
      });
    }
  }

  it('worked examples: Belt d4 intact 35/18; d5 + gyro broken 52 (Severe) / 26 (High); Lunar Ring W1 d1 20/10', () => {
    expect(opt(pending(7, 4), 'thread').chance).toBe(35);
    expect(opt(pending(7, 4), 'shields').chance).toBe(18);
    const hard = pending(7, 5, { broken: { hull: false, pump: false, gyro: true } });
    expect(opt(hard, 'thread').chance).toBe(52);
    expect(opt(hard, 'thread').risk).toBe('severe');
    expect(opt(hard, 'shields').chance).toBe(26);
    expect(opt(hard, 'shields').risk).toBe('high');
    expect(opt(hard, 'tug').risk).toBe('none');
    expect(opt(hard, 'pilot').risk).toBe('low');
    const lunar = pending(1, 1, {}, 1);
    expect(opt(lunar, 'thread').chance).toBe(20);
    expect(opt(lunar, 'thread').risk).toBe('moderate');
    expect(opt(lunar, 'shields').chance).toBe(10);
    expect(opt(lunar, 'tug').price).toBe(25);
    expect(opt(lunar, 'pilot').blocker).toBe('No Belters work this stretch.');
    const helio = pending(13, 4, { route: 'direct', date: '2184-10-01' });
    expect(opt(helio, 'thread').chance).toBe(45);
    expect(opt(helio, 'shields').chance).toBe(23);
    expect(opt(helio, 'tug').price).toBe(135);
  });

  it('the Flare Belt Thread is the M1 roll: 45 (60 in flare season), no density factor, no ship modifier', () => {
    for (const density of [3, 5]) {
      expect(opt(pending(15, density), 'thread').chance).toBe(45);
      expect(opt(pending(15, density, { date: FLARE_DATE }), 'thread').chance).toBe(60);
      const wrecked = pending(15, density, { broken: { hull: true, pump: false, gyro: true }, supplies: { drives: 1 } });
      expect(opt(wrecked, 'thread').chance).toBe(45);
    }
  });

  it('Thread incident rate matches the formula (Belt d5, gyro broken: 52%, n = 3000)', () => {
    const t = tally(pending(7, 5, { broken: { hull: false, pump: false, gyro: true } }), 'thread', 3000);
    expectRate(t.total - t.counts['clear']!, t.total, 0.52, 4, 'thread incident');
  });

  it('Shields incident rate is half (26%), 15% pump strain, never Lost', () => {
    const t = tally(pending(7, 5, { broken: { hull: false, pump: false, gyro: true } }), 'shields', 3000);
    expectRate(t.total - t.counts['clear']!, t.total, 0.26, 4, 'shields incident');
    expectRate(t.pump, t.total, 0.15, 4, 'pump strain');
    expect(t.counts['lost']).toBe(0);
  });
});

describe('severity (trail.md table + hazards.md modifiers)', () => {
  it('Thread at density >= 4: Lost on 10% of incidents (3.5% of Belt d4 crossings)', () => {
    const t = tally(pending(7, 4), 'thread', 5000);
    expectRate(t.counts['lost']!, t.total, 0.035, 4, 'thread lost @ d4');
  });

  it('Thread at density < 4 gets no +5: Lost on 5% of incidents (Debris Ring d2: 0.75%)', () => {
    const t = tally(pending(1, 2), 'thread', 8000);
    expectRate(t.counts['lost']!, t.total, 0.0075, 4, 'thread lost @ d2');
  });

  it('Shields: severity -10, so Lost never happens; Injury only on d100 >= 91 at density >= 4 (10% of incidents)', () => {
    const s = pending(7, 5, { broken: { hull: false, pump: false, gyro: true } });
    const t = tally(s, 'shields', 4000);
    expect(t.counts['lost']).toBe(0);
    const incidents = t.total - t.counts['clear']!;
    expectRate(t.counts['injury']!, incidents, 0.1, 4, 'shields injury share');
    // severity = d100 + 5 - 10: scraped 1-40 -> d100 <= 45 (45% of incidents)
    expectRate(t.counts['scraped']!, incidents, 0.45, 4, 'shields scraped share');
  });

  it('Shields at density < 4: no +5, so Injury needs d100 >= 96 (5% of incidents) and Lost never', () => {
    const t = tally(pending(1, 1, { }, 1), 'shields', 8000);
    expect(t.counts['lost']).toBe(0);
    const incidents = t.total - t.counts['clear']!;
    expectRate(t.counts['injury']!, incidents, 0.05, 4, 'shields injury share d1');
  });

  it('Flare Belt Thread: severity +5, +10 in flare season (Lost on 10% / 20% of incidents)', () => {
    const n = 4000;
    const normal = tally(pending(15, 5), 'thread', n);
    expectRate(normal.counts['lost']!, normal.total, 0.45 * 0.1, 4, 'flare belt lost');
    const season = tally(pending(15, 5, { date: FLARE_DATE }), 'thread', n);
    expectRate(season.counts['lost']!, season.total, 0.6 * 0.2, 4, 'flare belt lost (season)');
  });
});

describe('Hire a tug', () => {
  it('has zero incident chance: every crossing is clear, no pump strain, price deducted', () => {
    for (const idx of HAZ) {
      for (let seed = 1; seed <= 100; seed++) {
        const s = pending(idx, H[idx]!.nominal);
        const r = cross(s, 'tug', seed);
        expect(outcomeOf(r.entries)).toBe('clear');
        expect(r.entries.some((e) => e.id === 'pump-strain')).toBe(false);
        expect(r.state.credits).toBeCloseTo(500 - H[idx]!.tug, 9);
        expect(r.state.day).toBe(s.day);
      }
    }
  });

  it('tows a broken ship (no drives, broken pump)', () => {
    const s = pending(7, 4, { supplies: { drives: 0 }, broken: { hull: true, pump: true, gyro: true } });
    const r = cross(s, 'tug', 1);
    expect(r.error).toBeUndefined();
    expect(r.state.crossing).toBeNull();
  });

  it('costs x1.5 in flare season (half up), from 15 Sep 2184', () => {
    const FLARE: Record<number, number> = { 1: 38, 2: 53, 7: 120, 9: 90, 13: 135, 15: 180 };
    for (const idx of HAZ) {
      expect(opt(pending(idx, H[idx]!.nominal, { date: FLARE_DATE }), 'tug').price).toBe(FLARE[idx]);
      expect(opt(pending(idx, H[idx]!.nominal, { date: '2184-09-14' }), 'tug').price).toBe(H[idx]!.tug);
      expect(opt(pending(idx, H[idx]!.nominal, { date: '2184-09-15' }), 'tug').price).toBe(FLARE[idx]);
      const r = cross(pending(idx, H[idx]!.nominal, { date: FLARE_DATE, credits: 1000 }), 'tug', 1);
      expect(r.state.credits).toBeCloseTo(1000 - FLARE[idx]!, 9);
    }
  });
});

describe('Wait for a Belter pilot', () => {
  const quiet = (es: readonly LogEntry[]): boolean => !es.some((e) => ['event', 'help', 'death', 'condition', 'gameover'].includes(e.kind));

  it('incident chance is a flat 3% and never Injury or Lost (severity -20)', () => {
    let total = 0;
    let incidents = 0;
    let bad = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const r = cross(pending(7, 5, { broken: { hull: true, pump: false, gyro: true }, supplies: { drives: 1 } }), 'pilot', seed);
      if (r.state.crossing || !r.entries.some((e) => e.id === 'pilot-arrives')) continue;
      total++;
      const o = outcomeOf(r.entries)!;
      if (o !== 'clear') incidents++;
      if (o === 'injury' || o === 'lost') bad++;
    }
    expect(total).toBeGreaterThan(1500);
    expectRate(incidents, total, 0.03, 4, 'pilot incident');
    expect(bad).toBe(0);
  });

  it('wait days are real days: Belt 4 days / Saturn 3 days tick the clock and eat rations, plus 10 cr', () => {
    const cases: [number, number][] = [[7, 4], [9, 3]];
    for (const [idx, wait] of cases) {
      let checked = 0;
      for (let seed = 1; seed <= 200 && checked < 20; seed++) {
        const s = pending(idx, H[idx]!.nominal);
        const r = cross(s, 'pilot', seed);
        if (r.state.crossing || !quiet(r.entries)) continue;
        checked++;
        expect(r.state.day).toBe(s.day + wait);
        expect(daysBetween(s.date, r.state.date)).toBe(wait);
        expect(r.state.credits).toBeCloseTo(490, 9);
        // Half rations, five crew: 10 per day (executive has no discount)
        expect(s.supplies.rations - r.state.supplies.rations).toBe(10 * wait);
        expect(r.entries.filter((e) => e.id === 'pilot-wait').length).toBe(wait);
        expect(r.entries.some((e) => e.id === 'pilot')).toBe(true);
        expect(r.state.arrivedAt).toBe(idx); // still parked
      }
      expect(checked).toBeGreaterThanOrEqual(10);
    }
  });

  it('while a pilot is on the way other methods are refused; calling pilot again resumes without paying', () => {
    const s = pending(7, 4, { credits: 0, crossing: { waypoint: 7, density: 4, pilotDaysLeft: 2 } });
    for (const m of ['thread', 'shields', 'tug'] as const) expect(applyAction(s, { type: 'cross', method: m }, createRng(1)).error).toBe('You already sent for a pilot.');
    const r = cross(s, 'pilot', 1);
    expect(r.error).toBeUndefined();
    expect(r.state.credits).toBe(0);
    if (!r.state.crossing) expect(r.state.day).toBe(s.day + 2);
  });

  it('is refused away from the Belt Crossing and Saturn Ring Plane, and without 10 cr', () => {
    for (const idx of [1, 2, 13, 15]) expect(cross(pending(idx, H[idx]!.nominal), 'pilot', 1).error).toBeTruthy();
    expect(cross(pending(7, 4, { credits: 9.99 }), 'pilot', 1).error).toBe('You cannot afford a pilot.');
  });
});

describe('risk words (hazards.md readout)', () => {
  it('0 None, 1-9 Low, 10-24 Moderate, 25-44 High, >= 45 Severe', () => {
    const table: [number, string][] = [
      [0, 'none'], [1, 'low'], [9, 'low'], [10, 'moderate'], [24, 'moderate'], [25, 'high'], [44, 'high'], [45, 'severe'], [60, 'severe'], [95, 'severe'],
    ];
    for (const [pct, word] of table) expect(riskWord(pct), `${pct}%`).toBe(word);
  });

  it('blocked options show no risk word', () => {
    const s = pending(7, 4, { supplies: { drives: 0 } });
    expect(opt(s, 'thread').risk).toBeNull();
    expect(opt(s, 'tug').risk).toBe('none');
  });
});

describe('RNG determinism (hazards.md "RNG draw order")', () => {
  const methods: CrossMethod[] = ['thread', 'shields', 'tug', 'pilot'];

  it('identical seeds give identical outcomes, states and logs for every method', () => {
    for (const m of methods) for (let seed = 1; seed <= 60; seed++) {
      const s = pending(7, 5, { broken: { hull: false, pump: false, gyro: true } });
      const a = cross(s, m, seed);
      const b = cross(s, m, seed);
      expect(b.state).toEqual(a.state);
      expect(b.entries).toEqual(a.entries);
    }
  });

  it('different seeds vary the thread outcome', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) seen.add(outcomeOf(cross(pending(7, 5), 'thread', seed).entries)!);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('crossing does not mutate the input state', () => {
    const s = pending(7, 4);
    const snapshot = JSON.stringify(s);
    cross(s, 'shields', 5);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('log order: crossing (method), hazard (outcome), then pump-strain for shields', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const r = cross(pending(7, 4), 'shields', seed);
      const ids = r.entries.filter((e) => e.kind === 'crossing' || e.kind === 'hazard').map((e) => `${e.kind}:${e.id}`);
      expect(ids[0]).toBe('crossing:shields');
      expect(ids[1]).toMatch(/^hazard:(clear|scraped|cargo|damage|injury)$/);
      const strain = ids.indexOf('hazard:pump-strain');
      if (strain >= 0) expect(strain).toBe(ids.length - 1);
    }
  });
});
