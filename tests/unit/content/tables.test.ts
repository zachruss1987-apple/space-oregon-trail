import { describe, expect, it } from 'vitest';
import {
  CONDITIONS, CONDITION_LIST, DEFAULT_CREW_NAMES, EVENTS, EVENT_LIST, FINAL_WAYPOINT, ILLNESS_POOL, ITEMS, LATE_ROWS,
  MID_ROW, NAME_POOL, PROFESSIONS, SCORE, THRUST, RATIONS, TOTAL_MK, WAYPOINTS, WEATHER, WINDOWS, WINDOW_ORDER,
  isStation, toId,
} from '@/content';

describe('waypoints (trail.md)', () => {
  it('has 17 entries (index 0 start) and 16 segments totalling 2,040 Mk', () => {
    expect(WAYPOINTS).toHaveLength(17);
    expect(FINAL_WAYPOINT).toBe(16);
    expect(WAYPOINTS.slice(1).filter((w) => w.mk > 0)).toHaveLength(16);
    expect(TOTAL_MK).toBe(2040);
    expect(WAYPOINTS.reduce((s, w) => s + w.mk, 0)).toBe(2040);
  });

  it('mirrors the cumulative column exactly', () => {
    const cumulative = [0, 102, 185, 304, 554, 640, 830, 932, 989, 1151, 1208, 1390, 1504, 1664, 1719, 1839, 2040];
    expect(WAYPOINTS.map((w) => w.cumulative)).toEqual(cumulative);
    WAYPOINTS.forEach((w, i) => expect(w.index).toBe(i));
  });

  it('uses kebab-case ids of the names', () => {
    expect(WAYPOINTS.map((w) => w.id)).toEqual([
      'independence-station', 'lunar-debris-ring', 'lagrange-shoals', 'mars-relay', 'ceres-approach-spire', 'ceres-depot',
      'jupiters-eye', 'the-belt-crossing', 'europa-outpost', 'saturn-ring-plane', 'titan-refinery', 'kuiper-gate',
      'oort-beacon', 'proxima-heliopause-shock', 'lane-terminus-station', 'the-flare-belt', 'new-willamette',
    ]);
    expect(toId("Jupiter's Eye")).toBe('jupiters-eye');
  });

  it('gives every hazard its parameters and nothing else', () => {
    const hazards = WAYPOINTS.filter((w) => w.type === 'hazard');
    expect(hazards.map((w) => [w.hazard!.density, w.hazard!.incident, w.hazard!.tugPrice])).toEqual([
      [2, 15, 25], [2, 15, 35], [4, 35, 80], [3, 25, 60], [4, 35, 90], [5, 45, 120],
    ]);
    expect(WAYPOINTS.filter((w) => w.hazard && w.type !== 'hazard')).toHaveLength(0);
  });

  it('types: start, stations, landmark, gate, end', () => {
    expect(WAYPOINTS[0]!.type).toBe('start');
    expect(WAYPOINTS[11]!.type).toBe('gate');
    expect(WAYPOINTS[16]!.type).toBe('end');
    expect(WAYPOINTS.filter(isStation).map((w) => w.index)).toEqual([0, 3, 5, 8, 10, 12, 14]);
    // economy.md "Markups": per-item maps, every markup in 1.0-2.5; Independence is list price for everything.
    expect(WAYPOINTS.filter(isStation).every((w) => Object.values(w.markup ?? {}).every((m) => m >= 1 && m <= 2.5))).toBe(true);
    expect(Object.values(WAYPOINTS[0]!.markup!)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });
});

describe('items (resources.md)', () => {
  it('base prices, pack sizes and limits', () => {
    expect(ITEMS.drives).toMatchObject({ basePrice: 40, buyLimit: 9, cap: 9 });
    expect(ITEMS.rations).toMatchObject({ basePrice: 0.3, buyLimit: 3000, cap: null });
    expect(ITEMS.suits).toMatchObject({ basePrice: 10, buyLimit: 99 });
    expect(ITEMS.charges).toMatchObject({ basePrice: 2, packSize: 20, buyLimit: 99 });
    for (const k of ['plates', 'pumps', 'gyros'] as const) expect(ITEMS[k]).toMatchObject({ basePrice: 10, buyLimit: 3, cap: 3 });
  });
});

describe('professions (world.md)', () => {
  it('credits, multipliers and exact perk numbers', () => {
    expect(PROFESSIONS.executive).toMatchObject({ credits: 1600, multiplier: 1, repairSuccess: 0.8, spareLossOnFail: 0.3 });
    // Engineer credits 650 and Farmer ration factor 0.65 since T-039, decisions.md 2026-10-25.
    expect(PROFESSIONS.engineer).toMatchObject({ credits: 650, multiplier: 2, repairSuccess: 0.95, spareLossOnFail: 0.1, driveFailureWeight: 0.5 });
    expect(PROFESSIONS.farmer).toMatchObject({ credits: 400, multiplier: 3, rationFactor: 0.65, algaeFactor: 1.5 });
  });
});

describe('windows and weather (world.md, travel.md)', () => {
  it('five windows start on the 1st of March–July 2184', () => {
    expect(WINDOW_ORDER.map((w) => WINDOWS[w].start)).toEqual(['2184-03-01', '2184-04-01', '2184-05-01', '2184-06-01', '2184-07-01']);
    expect([WINDOWS[1].hazardBonus, WINDOWS[2].hazardBonus, WINDOWS[3].hazardBonus]).toEqual([10, 5, 0]);
  });

  it('every row sums to 100 and Flare appears only in late rows', () => {
    const rows = [...WINDOW_ORDER.map((w) => WINDOWS[w].earlyRow), MID_ROW, LATE_ROWS.before, LATE_ROWS.flareSeason];
    for (const r of rows) expect(r.reduce((a, b) => a + b, 0)).toBe(100);
    for (const r of [...WINDOW_ORDER.map((w) => WINDOWS[w].earlyRow), MID_ROW]) expect(r[5]).toBe(0);
    expect(LATE_ROWS.flareSeason[5]).toBe(40);
  });

  it('weather speed and health match the table', () => {
    expect(WEATHER.storm).toMatchObject({ speed: 0.6, healthUnsuited: -3, healthSuited: -1, radiation: true });
    expect(WEATHER.flare).toMatchObject({ speed: 0.5, healthUnsuited: -5, healthSuited: -2 });
    expect(WEATHER.fog.speed).toBe(0.7);
    expect(WEATHER.unsettled.speed).toBe(0.9);
  });

  it('thrust and rations tables', () => {
    expect(Object.values(THRUST).map((t) => [t.mkPerDay, t.health])).toEqual([[22, 0], [27, -2], [33, -5]]) // T-039, decisions.md 2026-10-25;
    expect(Object.values(RATIONS).map((r) => [r.perCrew, r.health])).toEqual([[3, 2], [2, 0], [1, -2]]);
  });
});

describe('conditions (health.md)', () => {
  it('has the 8 conditions in table order with exact numbers', () => {
    expect(CONDITION_LIST.map((c) => [c.duration[0], c.duration[1], c.dailyHealth, c.deathChance])).toEqual([
      [5, 10, -4, 0.01], [4, 8, -6, 0.03], [7, 14, -3, 0.02], [6, 12, -2, 0.005],
      [3, 6, -6, 0.04], [5, 9, -5, 0.02], [2, 2, -3, 0], [10, 20, -1, 0],
    ]);
    expect(CONDITIONS['micrometeorite-puncture']).toMatchObject({ deathDays: 2, deathChanceSuited: 0.01 });
    expect(CONDITIONS.scurvy.fullRationsCap).toBe(3);
  });
});

describe('events (events.md)', () => {
  it('has the 15 table events with base weights', () => {
    expect(EVENT_LIST.map((e) => [e.id, e.weight])).toEqual([
      ['illness', 20], ['pirates', 6], ['lost_lane', 6], ['drive_failure', 4], ['drive_stall', 6], ['hull_puncture', 6],
      ['pump_failure', 5], ['gyro_failure', 4], ['hull_fire', 3], ['crew_eva_drift', 3], ['bad_recycler', 6],
      ['derelict', 4], ['algae_bloom', 5], ['belter_help', 3], ['cargo_shift', 3],
    ]);
    expect(EVENTS.belter_help).toMatchObject({ minSegment: 5, maxSegment: 9 });
  });

  it('loss events are exactly the cadence-guard list', () => {
    expect(EVENT_LIST.filter((e) => e.category === 'loss').map((e) => e.id).sort()).toEqual(
      ['bad_recycler', 'cargo_shift', 'crew_eva_drift', 'drive_failure', 'drive_stall', 'gyro_failure', 'hull_fire',
        'hull_puncture', 'lost_lane', 'pirates', 'pump_failure'].sort(),
    );
  });

  it('illness pool weights', () => {
    expect(ILLNESS_POOL.map((e) => e.weight)).toEqual([6, 3, 4, 4, 3]);
  });
});

describe('names and scoring', () => {
  it('defaults and a 20-name pool of unique ≤ 12-char names', () => {
    expect(DEFAULT_CREW_NAMES).toEqual(['Ezra', 'Temperance', 'Amos', 'Lucinda', 'Hollis']);
    expect(new Set(NAME_POOL).size).toBe(20);
    expect([...NAME_POOL, ...DEFAULT_CREW_NAMES].every((n) => n.length <= 12)).toBe(true);
  });

  it('score constants', () => {
    expect(SCORE.crewByHealth.map((b) => b.points)).toEqual([500, 400, 300, 200]);
    expect([SCORE.flareBonus, SCORE.noDeathsBonus]).toEqual([200, 300]);
  });
});
