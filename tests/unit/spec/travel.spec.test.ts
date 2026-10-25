/** docs/design/travel.md: the daily tick, thrust, distance, rations, weather, rest. (Repairs/scan: repairs.spec.test.ts.) */
import { describe, expect, it } from 'vitest';
import { applyAction, createRng, dailyDistance, intentBlocker, isSuited, rationNeed, tick, type RationId, type ThrustId } from '@/sim';
import {
  CONTINUE, DRIVE_SPEC, RATION_SPEC, THRUST_SPEC, WEATHER_SPEC, allHealth, daysBetween, expectRate, isQuiet, quietTick, runTrials, ship,
  withCrew, type WeatherName,
} from './spec-helpers';

const massSpec = (rations: number): number => 1 - Math.min(0.15, (0.05 * Math.max(0, rations - 1000)) / 1000);
const suitedHealth = (w: string): number => WEATHER_SPEC[w as WeatherName].suited;

describe('Thrust and distance (travel.md "Thrust", "Distance")', () => {
  // T-039 (decisions.md 2026-10-25): base thrust 22/27/33 (was 20/25/30).
  it.each([['cruise', 22], ['hard', 27], ['overburn', 33]] as const)('%s burns %i Mk/day base (3 drives, fair weather, 1000 rations)', (thrust, mk) => {
    expect(dailyDistance(ship({ thrust, weather: 'fair', supplies: { rations: 1000 } }))).toBeCloseTo(mk, 9);
  });

  it('distance = base x driveFactor x weatherFactor x massFactor x damageFactor over a real tick, for every thrust and drive count', () => {
    for (const thrust of ['cruise', 'hard', 'overburn'] as ThrustId[]) {
      for (let drives = 0; drives <= 6; drives++) {
        const { r } = quietTick(ship({ thrust, supplies: { drives, rations: 2400 } }));
        const w = r.state.weather as WeatherName;
        const want = THRUST_SPEC[thrust].mk * DRIVE_SPEC[Math.min(drives, 4)]! * WEATHER_SPEC[w].speed * massSpec(2400);
        expect(r.state.distanceInSegment, `${thrust} ${drives} drives ${w}`).toBeCloseTo(want, 9);
      }
    }
  });

  it.each([[0, 0], [1, 0.6], [2, 0.85], [3, 1.0], [4, 1.1], [5, 1.1], [9, 1.1]])('drive factor with %i working drives is %f', (drives, f) => {
    expect(dailyDistance(ship({ weather: 'fair', supplies: { drives, rations: 1000 } }))).toBeCloseTo(22 * f, 9);
  });

  it('working drives = owned minus offline (4 owned, 1 stalled -> factor 1.0)', () => {
    expect(dailyDistance(ship({ weather: 'fair', offlineDrives: [2], supplies: { drives: 4, rations: 1000 } }))).toBeCloseTo(22, 9);
  });

  it('with every drive offline the ship does not move', () => {
    expect(dailyDistance(ship({ weather: 'fair', offlineDrives: [2, 2, 2], supplies: { drives: 3 } }))).toBe(0);
  });

  it.each([['calm', 1.0], ['fair', 1.0], ['unsettled', 0.9], ['storm', 0.6], ['fog', 0.7], ['flare', 0.5]] as const)(
    '%s weather speed factor is %f', (weather, f) => {
      expect(dailyDistance(ship({ weather, supplies: { rations: 1000 } }))).toBeCloseTo(22 * f, 9);
    });

  it.each([[0, 1], [1000, 1], [1500, 0.975], [2000, 0.95], [3000, 0.9], [4000, 0.85], [9000, 0.85]])(
    'ration mass factor at %i rations is %f (-5%% per 1000 over 1000, capped at -15%%)', (rations, f) => {
      expect(dailyDistance(ship({ weather: 'fair', supplies: { rations } }))).toBeCloseTo(22 * f, 9);
    });

  it('a broken coolant pump means no movement', () => {
    expect(dailyDistance(ship({ weather: 'fair', broken: { hull: false, pump: true, gyro: false } }))).toBe(0);
  });

  it('a broken hull plate halves speed', () => {
    const ok = dailyDistance(ship({ weather: 'fair' }));
    expect(dailyDistance(ship({ weather: 'fair', broken: { hull: true, pump: false, gyro: false } }))).toBeCloseTo(ok * 0.5, 9);
  });

  it('pump broken beats hull broken (damage factor 0, not 0.25)', () => {
    expect(dailyDistance(ship({ weather: 'fair', broken: { hull: true, pump: true, gyro: false } }))).toBe(0);
  });

  it('a broken nav gyro does not slow the ship', () => {
    const ok = dailyDistance(ship({ weather: 'fair' }));
    expect(dailyDistance(ship({ weather: 'fair', broken: { hull: false, pump: false, gyro: true } }))).toBeCloseTo(ok, 9);
  });

  it('distance is not rounded internally (fractions are kept)', () => {
    const { r } = quietTick(ship({ supplies: { rations: 1234 } }), CONTINUE, (x) => isQuiet(x.r.entries) && x.r.state.weather === 'fog');
    expect(r.state.distanceInSegment).toBeGreaterThan(0);
    expect(Number.isInteger(r.state.distanceInSegment * 1000)).toBe(false);
  });
});

describe('Order of operations (travel.md steps 1, 4, 10)', () => {
  it('each tick adds one day and one calendar day (month rollover)', () => {
    const s = ship({ date: '2184-04-30' });
    const r = tick(s, createRng(5));
    expect(r.state.day).toBe(s.day + 1);
    expect(r.state.date).toBe('2184-05-01');
  });

  it('tick is a no-op unless the status is traveling', () => {
    const r = tick(ship({ status: 'store' }), createRng(1));
    expect(r.state.day).toBe(0);
    expect(r.entries).toEqual([]);
  });

  it('does not mutate its input state', () => {
    const s = ship();
    const before = JSON.stringify(s);
    applyAction(s, CONTINUE, createRng(3));
    expect(JSON.stringify(s)).toBe(before);
  });

  it('distance is clamped to the remaining segment and overflow is lost', () => {
    // Segment 3 is Mars Relay (a station: no hazard roll), 119 Mk long, cumulative 304.
    const r = tick(ship({ segment: 3, distanceInSegment: 118, distanceTotal: 303 }), createRng(2)).state;
    expect(r.arrivedAt).toBe(3);
    expect(r.distanceTotal).toBe(304);
    expect(r.segment).toBe(4);
    expect(r.distanceInSegment).toBe(0);
  });

  it('arriving sets arrivedAt, and continuing from the waypoint clears it', () => {
    const parked = tick(ship({ segment: 3, distanceInSegment: 118, distanceTotal: 303 }), createRng(2)).state;
    expect(parked.arrivedAt).toBe(3);
    expect(applyAction(parked, CONTINUE, createRng(2)).state.arrivedAt).toBeNull();
  });

  it('a ship between waypoints has arrivedAt null', () => {
    expect(quietTick(ship()).r.state.arrivedAt).toBeNull();
  });

  it('reaching New Willamette with a living crew ends the run as arrived', () => {
    const s = ship({ segment: 16, distanceInSegment: 200, distanceTotal: 2039 });
    const t = runTrials(s, CONTINUE, 50, (x) => x.r.state.arrivedAt === 16)[0]!;
    expect(t.r.state.status).toBe('arrived');
  });

  it('delay days: distance 0 until they are used up, then the ship moves', () => {
    const a = quietTick(ship({ delayDays: 2 })).r.state;
    expect(a.distanceInSegment).toBe(0);
    expect(a.delayDays).toBe(1);
    const b = quietTick(a).r.state;
    expect(b.distanceInSegment).toBe(0);
    expect(b.delayDays).toBe(0);
    expect(quietTick(b).r.state.distanceInSegment).toBeGreaterThan(0);
  });
});

describe('Rations (travel.md "Rations")', () => {
  it.each([
    ['executive', 'full', 15], ['executive', 'half', 10], ['executive', 'paste', 5], ['engineer', 'full', 15],
    // Farmer floor(need x 0.65) since T-039 (decisions.md 2026-10-25; was x0.85).
    ['farmer', 'full', 9], ['farmer', 'half', 6], ['farmer', 'paste', 3],
  ] as const)('%s on %s rations needs %i ration-days for five crew', (profession, setting, need) => {
    expect(rationNeed(ship({ rations: setting as RationId }, profession))).toBe(need);
  });

  it('Farmer need has a minimum of 1 (one crew member on Paste: floor(0.65) = 0 -> 1)', () => {
    let s = ship({ rations: 'paste' }, 'farmer');
    s = { ...s, crew: s.crew.map((c, i) => (i === 0 ? c : { ...c, alive: false })) };
    expect(rationNeed(s)).toBe(1);
  });

  it('missing (drifting) crew eat nothing', () => {
    expect(rationNeed(withCrew(withCrew(ship(), 3, { awayDays: 2 }), 4, { awayDays: 2 }))).toBe(9);
  });

  it('dead crew eat nothing', () => {
    expect(rationNeed(withCrew(ship(), 1, { alive: false, health: 0 }))).toBe(12);
  });

  it.each(['full', 'half', 'paste'] as const)('a day on %s consumes exactly the daily need', (setting) => {
    const { r } = quietTick(ship({ rations: setting, supplies: { rations: 1000 } }));
    expect(r.state.supplies.rations).toBe(1000 - 5 * RATION_SPEC[setting].per);
  });

  it('Starving day: shortfall eats what is left (rations -> 0) and is logged', () => {
    const { r } = quietTick(ship({ supplies: { rations: 7 } }));
    expect(r.state.supplies.rations).toBe(0);
    expect(r.entries.some((e) => e.kind === 'starving')).toBe(true);
  });

  it('Starving day: every present crew member takes -10 instead of the ration effect', () => {
    const { r } = quietTick(allHealth(ship({ supplies: { rations: 7 } }), 80));
    for (const c of r.state.crew) expect(c.health).toBe(80 - 10 + suitedHealth(r.state.weather));
  });

  it('Exactly enough rations is not a starving day', () => {
    const { r } = quietTick(allHealth(ship({ supplies: { rations: 15 } }), 80));
    expect(r.state.supplies.rations).toBe(0);
    expect(r.entries.some((e) => e.kind === 'starving')).toBe(false);
    expect(r.state.crew[0]!.health).toBe(80 + 2 + suitedHealth(r.state.weather));
  });

  it('With rations already at 0 the day is starving (-10)', () => {
    const { r } = quietTick(allHealth(ship({ supplies: { rations: 0 } }), 60));
    expect(r.state.crew[0]!.health).toBe(60 - 10 + suitedHealth(r.state.weather));
  });
});

describe('Thrust and ration health effects (moving days only for thrust)', () => {
  it.each([['cruise', 0], ['hard', -2], ['overburn', -5]] as const)('%s costs %i health per moving day', (thrust, delta) => {
    const { r } = quietTick(allHealth(ship({ thrust, rations: 'half' }), 80));
    expect(r.state.distanceInSegment).toBeGreaterThan(0);
    expect(r.state.crew[0]!.health).toBe(80 + delta + suitedHealth(r.state.weather));
  });

  it('Hard burn costs 2 health per moving day but nothing on a rest day', () => {
    const { r } = quietTick(allHealth(ship({ thrust: 'hard', rations: 'half' }), 70), { type: 'rest', days: 1 });
    expect(r.state.crew[0]!.health).toBe(70 + 3 + suitedHealth(r.state.weather));
  });

  it('a ship that cannot move (pump broken) pays no thrust penalty', () => {
    const s = allHealth(ship({ thrust: 'overburn', rations: 'half', broken: { hull: false, pump: true, gyro: false } }), 70);
    const { r } = quietTick(s);
    expect(r.state.crew[0]!.health).toBe(70 + suitedHealth(r.state.weather));
  });

  it.each([['full', 2], ['half', 0], ['paste', -2]] as const)('%s rations change health by %i/day', (rations, delta) => {
    const { r } = quietTick(allHealth(ship({ rations }), 80));
    expect(r.state.crew[0]!.health).toBe(80 + delta + suitedHealth(r.state.weather));
  });
});

describe('Weather health and suits (travel.md weather table, "Suited")', () => {
  it.each(['calm', 'fair', 'unsettled', 'storm', 'fog'] as const)('%s: health unsuited / suited matches the table', (target) => {
    const s0 = allHealth(ship({ weather: target, rations: 'half' }), 80);
    for (const suits of [0, 10]) {
      const trials = runTrials({ ...s0, supplies: { ...s0.supplies, suits } }, CONTINUE, 150);
      expect(trials.length).toBeGreaterThan(20);
      for (const { r } of trials) {
        const spec = WEATHER_SPEC[r.state.weather as WeatherName];
        expect(r.state.crew[0]!.health).toBe(80 + (suits === 0 ? spec.unsuited : spec.suited));
      }
    }
  });

  it('Flare (segment 15, flare season): -5 unsuited / -2 suited, speed 0.5', () => {
    const base = allHealth(ship({ segment: 15, distanceTotal: 1719, weather: 'flare', date: '2184-09-20', rations: 'half' }), 80);
    for (const suits of [0, 10]) {
      const trials = runTrials({ ...base, supplies: { ...base.supplies, suits } }, CONTINUE, 200).filter((t) => t.r.state.weather === 'flare');
      expect(trials.length).toBeGreaterThan(20);
      for (const { r } of trials) {
        expect(r.state.crew[0]!.health).toBe(80 + (suits === 0 ? -5 : -2));
        expect(r.state.distanceInSegment).toBeCloseTo(22 * 0.5 * massSpec(1500), 9);
      }
    }
  });

  it('Suited: with suits >= present crew everyone is suited', () => {
    const s = ship({ supplies: { suits: 5 } });
    for (const c of s.crew) expect(isSuited(s, c)).toBe(true);
  });

  it('Suited: with fewer suits the first N present crew in roster order (captain first) are suited', () => {
    const s = ship({ supplies: { suits: 2 } });
    expect(s.crew.map((c) => isSuited(s, c))).toEqual([true, true, false, false, false]);
  });

  it('Suited: absent crew are skipped when assigning suits', () => {
    const s = withCrew(ship({ supplies: { suits: 2 } }), 0, { awayDays: 3 });
    expect(s.crew.map((c) => isSuited(s, c))).toEqual([false, true, true, false, false]);
  });

  it('with zero suits nobody is suited', () => {
    const s = ship({ supplies: { suits: 0 } });
    expect(s.crew.some((c) => isSuited(s, c))).toBe(false);
  });

  it('Storm health: the unsuited crew member loses 3, the suited one loses 1 (same tick)', () => {
    const s = allHealth(ship({ weather: 'storm', rations: 'half', supplies: { suits: 2 } }), 80);
    const trials = runTrials(s, CONTINUE, 200, (t) => isQuiet(t.r.entries) && t.r.state.weather === 'storm');
    expect(trials.length).toBeGreaterThan(10);
    for (const { r } of trials) {
      expect(r.state.crew[0]!.health).toBe(79);
      expect(r.state.crew[4]!.health).toBe(77);
    }
  });
});

describe('Solar storm side effects (travel.md step 6, weather table)', () => {
  it('Suit wear: 25% chance per storm day to lose exactly 1 suit (T-039, was 20%)', () => {
    const s = allHealth(ship({ weather: 'storm' }), 90);
    let storms = 0;
    let lost = 0;
    for (let seed = 1; seed <= 2500; seed++) {
      const r2 = tick(s, createRng(seed));
      const r = r2.state;
      if (r.weather !== 'storm' || r2.entries.some((e) => e.kind === 'event')) continue;
      storms++;
      const d = 10 - r.supplies.suits;
      expect(d === 0 || d === 1).toBe(true);
      lost += d;
    }
    expectRate(lost, storms, 0.25, 4, 'suit loss');
  });

  it('Suit wear never happens on fair or calm days (no suit entry)', () => {
    const s = ship({ weather: 'fair' });
    for (let seed = 1; seed <= 300; seed++) {
      const r = tick(s, createRng(seed));
      if (r.state.weather === 'fair' || r.state.weather === 'calm') expect(r.entries.some((e) => e.kind === 'suit')).toBe(false);
    }
  });

  it('with no suits there is nothing to lose (suits stay 0)', () => {
    const s = ship({ weather: 'storm', supplies: { suits: 0 } });
    for (let seed = 1; seed <= 100; seed++) expect(tick(s, createRng(seed)).state.supplies.suits).toBe(0);
  });

  it('each unsuited crew member has a 15% chance of radiation sickness on a storm day', () => {
    const s = allHealth(ship({ weather: 'storm', supplies: { suits: 0 } }), 100);
    let crewDays = 0;
    let sick = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const r = tick(s, createRng(seed)).state;
      if (r.weather !== 'storm') continue;
      for (const c of r.crew) {
        crewDays++;
        if (c.conditions.some((x) => x.id === 'radiation-sickness')) sick++;
      }
    }
    expectRate(sick, crewDays, 0.15, 4, 'radiation');
  });

  it('suited crew never catch radiation sickness', () => {
    const s = allHealth(ship({ weather: 'storm', supplies: { suits: 99 } }), 100);
    for (let seed = 1; seed <= 600; seed++) {
      expect(tick(s, createRng(seed)).state.crew.some((c) => c.conditions.some((x) => x.id === 'radiation-sickness'))).toBe(false);
    }
  });
});

describe('Weather Markov chain (travel.md "Weather Markov chain")', () => {
  type Row = [number, number, number, number, number, number];
  const NAMES: WeatherName[] = ['calm', 'fair', 'unsettled', 'storm', 'fog', 'flare'];
  const cases: { name: string; segment: number; window: 1 | 2 | 3 | 4 | 5; date: string; row: Row }[] = [
    { name: 'early, window 1 (segment 1)', segment: 1, window: 1, date: '2184-03-02', row: [5, 25, 30, 30, 10, 0] },
    { name: 'early, window 2', segment: 3, window: 2, date: '2184-04-02', row: [10, 35, 30, 15, 10, 0] },
    { name: 'early, window 3', segment: 3, window: 3, date: '2184-05-02', row: [15, 50, 20, 8, 7, 0] },
    { name: 'early, window 4', segment: 3, window: 4, date: '2184-06-02', row: [20, 50, 18, 6, 6, 0] },
    { name: 'early, window 5 (segment 5, last early)', segment: 5, window: 5, date: '2184-07-02', row: [35, 45, 12, 4, 4, 0] },
    { name: 'mid, window 1 (segment 6 is the first mid)', segment: 6, window: 1, date: '2184-04-02', row: [15, 45, 20, 10, 10, 0] },
    { name: 'mid, segment 13 (last mid, even in flare season)', segment: 13, window: 5, date: '2184-09-20', row: [15, 45, 20, 10, 10, 0] },
    { name: 'late, before flare season (segment 14)', segment: 14, window: 2, date: '2184-08-01', row: [10, 40, 20, 10, 10, 10] },
    { name: 'late, in flare season', segment: 15, window: 2, date: '2184-09-20', row: [5, 20, 20, 10, 5, 40] },
    { name: 'late, flare season starts on 15 Sep (tomorrow is the 15th)', segment: 15, window: 2, date: '2184-09-14', row: [5, 20, 20, 10, 5, 40] },
    { name: 'late, still before flare season on 14 Sep (tomorrow is the 14th)', segment: 16, window: 2, date: '2184-09-13', row: [10, 40, 20, 10, 10, 10] },
  ];

  it.each(cases)('tomorrow = 60% keep today, else draw from the row: $name', ({ segment, window, date, row }) => {
    const s = ship({ segment, window, date, weather: 'fair', distanceTotal: 0 });
    const n = 3000;
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= n; seed++) {
      const w = tick(s, createRng(seed * 7 + 1)).state.weather;
      counts[w] = (counts[w] ?? 0) + 1;
    }
    NAMES.forEach((name, i) => {
      const p = 0.4 * (row[i]! / 100) + (name === 'fair' ? 0.6 : 0);
      expectRate(counts[name] ?? 0, n, p, 4.5, `${name} after fair`);
    });
  });

  it('Flare never appears outside segments 14-16 (from a Flare state it redraws: no persistence)', () => {
    const s = ship({ segment: 8, weather: 'flare', date: '2184-10-01', distanceTotal: 0 });
    const n = 2000;
    let fair = 0;
    for (let seed = 1; seed <= n; seed++) {
      const w = tick(s, createRng(seed)).state.weather;
      expect(w).not.toBe('flare');
      if (w === 'fair') fair++;
    }
    expectRate(fair, n, 0.45, 4, 'fair after disallowed flare (pure row draw)');
  });

  it('Day 0 weather is Fair', () => {
    expect(ship().weather).toBe('fair');
  });
});

describe('Resting (travel.md "Resting")', () => {
  it('Rest asks for 1-9 days; anything else is refused and no day passes', () => {
    const s = ship();
    for (const days of [0, 10, -1, 2.5]) {
      expect(intentBlocker(s, { type: 'rest', days })).not.toBeNull();
      const r = applyAction(s, { type: 'rest', days }, createRng(1));
      expect(r.error).toBeTruthy();
      expect(r.state.day).toBe(s.day);
    }
    expect(intentBlocker(s, { type: 'rest', days: 1 })).toBeNull();
    expect(intentBlocker(s, { type: 'rest', days: 9 })).toBeNull();
  });

  it('Rest for n days runs n ticks: distance 0, n days and n calendar days later', () => {
    const s = ship();
    const out = runTrials(s, { type: 'rest', days: 4 }, 100, (t) => t.r.state.status === 'traveling' && t.r.state.deaths === 0)[0]!.r.state;
    expect(out.day).toBe(4);
    expect(daysBetween(s.date, out.date)).toBe(4);
    expect(out.distanceInSegment).toBe(0);
  });

  it('Rest restores +3 health/day away from a station', () => {
    const { r } = quietTick(allHealth(ship({ rations: 'half' }), 50), { type: 'rest', days: 1 });
    expect(r.state.crew[0]!.health).toBe(53 + suitedHealth(r.state.weather));
  });

  it('Rest restores +6 health/day at a station (Mars Relay, arrived and not departed)', () => {
    const { r } = quietTick(allHealth(ship({ rations: 'half', segment: 4, arrivedAt: 3 }), 50), { type: 'rest', days: 1 });
    expect(r.state.crew[0]!.health).toBe(56 + suitedHealth(r.state.weather));
  });

  it('Rest at a landmark (Ceres Approach Spire) gets no station bonus', () => {
    const { r } = quietTick(allHealth(ship({ rations: 'half', segment: 5, arrivedAt: 4 }), 50), { type: 'rest', days: 1 });
    expect(r.state.crew[0]!.health).toBe(53 + suitedHealth(r.state.weather));
  });

  it('Rest at Independence Station (start) counts as a station', () => {
    const { r } = quietTick(allHealth(ship({ rations: 'half', segment: 1, arrivedAt: 0, distanceTotal: 0 }), 50), { type: 'rest', days: 1 });
    expect(r.state.crew[0]!.health).toBe(56 + suitedHealth(r.state.weather));
  });

  it('Rest ticks condition durations down by 2 per day (normal days by 1)', () => {
    const s = withCrew(ship(), 0, { conditions: [{ id: 'space-dysentery', remaining: 8, daysActive: 1 }] });
    expect(quietTick(s, { type: 'rest', days: 1 }).r.state.crew[0]!.conditions[0]!.remaining).toBe(6);
    expect(quietTick(s, CONTINUE).r.state.crew[0]!.conditions[0]!.remaining).toBe(7);
  });

  it('Event chance is 15% per travel day and 7.5% per rest day', () => {
    const s = ship();
    const n = 5000;
    const fired = (rest: boolean): number => {
      let k = 0;
      for (let seed = 1; seed <= n; seed++) {
        const r = applyAction(s, rest ? { type: 'rest', days: 1 } : CONTINUE, createRng(seed * 3 + 1));
        if (r.entries.some((e) => e.kind === 'event' || (e.kind === 'condition' && e.id !== 'radiation-sickness'))) k++;
      }
      return k;
    };
    const t = fired(false);
    const r = fired(true);
    // Slack of 1.5 points: a few events (e.g. derelict "nothing") may log no entry.
    expectRate(t, n, 0.15, 4.5, 'travel events');
    expectRate(r, n, 0.075, 4.5, 'rest events');
    expect(t / r).toBeGreaterThan(1.6);
    expect(t / r).toBeLessThan(2.5);
  });

  it('Rest stops early on a death', () => {
    // Four crew are one health point from starving; the captain is fine. First rest day kills, rest stops.
    const s = allHealth(ship({ supplies: { rations: 0 } }), 1);
    const s2 = withCrew(s, 0, { health: 100 });
    const r = applyAction(s2, { type: 'rest', days: 9 }, createRng(4));
    expect(r.state.deaths).toBeGreaterThan(0);
    expect(r.state.day).toBe(1);
  });
});

describe('Free actions', () => {
  it('setThrust and setRations take no day', () => {
    const a = applyAction(ship(), { type: 'setThrust', thrust: 'hard' }, createRng(1)).state;
    expect(a.thrust).toBe('hard');
    expect(a.day).toBe(0);
    const b = applyAction(a, { type: 'setRations', rations: 'paste' }, createRng(1)).state;
    expect(b.rations).toBe('paste');
    expect(b.day).toBe(0);
  });

  it('the Overburn setting is accepted and consecutive Overburn days are counted', () => {
    const s = ship({ thrust: 'overburn' });
    const { r } = quietTick(s);
    expect(r.state.consecutiveOverburn).toBe(1);
  });
});
