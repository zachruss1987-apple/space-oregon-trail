/** docs/design/world.md: new-game initial state, professions, windows, crew names, flare season. */
import { describe, expect, it } from 'vitest';
import { createGame, createRng, isFlareSeason, isValidName, normalizeCrewNames, randomCrewNames, type ProfessionId, type WindowId } from '@/sim';

const POOL = ['Abigail', 'Bartholomew', 'Cora', 'Delphine', 'Eli', 'Florence', 'Gideon', 'Hester', 'Ignatius', 'Jemima',
  'Kit', 'Lavinia', 'Mordecai', 'Nell', 'Obadiah', 'Prudence', 'Silas', 'Theodora', 'Ulysses', 'Zebulon'];
const DEFAULTS = ['Ezra', 'Temperance', 'Amos', 'Lucinda', 'Hollis'];
// Engineer 650 since T-039, decisions.md 2026-10-25 (was 800).
const CREDITS: Record<ProfessionId, number> = { executive: 1600, engineer: 650, farmer: 400 };
const STARTS: Record<WindowId, string> = { 1: '2184-03-01', 2: '2184-04-01', 3: '2184-05-01', 4: '2184-06-01', 5: '2184-07-01' };
const make = (profession: ProfessionId = 'executive', window: WindowId = 1, crewNames?: string[]) =>
  createGame({ profession, window, ...(crewNames ? { crewNames } : {}) }, createRng(9));

describe('New game: initial state (world.md "New game")', () => {
  const s = make();

  it('profession and window are as chosen', () => {
    const g = make('farmer', 4);
    expect(g.profession).toBe('farmer');
    expect(g.window).toBe(4);
  });

  it('five crew at health 100 with no conditions, none away, all alive; crew[0] is the captain', () => {
    expect(s.crew).toHaveLength(5);
    for (const c of s.crew) {
      expect(c.health).toBe(100);
      expect(c.conditions).toEqual([]);
      expect(c.awayDays).toBe(0);
      expect(c.alive).toBe(true);
    }
    expect(s.crew[0]!.name).toBe('Ezra');
  });

  it.each(Object.entries(CREDITS) as [ProfessionId, number][])('%s starts with %i credits', (p, cr) => {
    expect(make(p).credits).toBe(cr);
  });

  it('supplies are all 0', () => {
    expect(s.supplies).toEqual({ drives: 0, rations: 0, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0 });
  });

  it('nothing is broken and no drive is offline', () => {
    expect(s.broken).toEqual({ hull: false, pump: false, gyro: false });
    expect(s.offlineDrives).toEqual([]);
  });

  it.each(Object.entries(STARTS) as unknown as [string, string][])('window %s starts on %s, day 0', (w, date) => {
    const g = make('executive', Number(w) as WindowId);
    expect(g.date).toBe(date);
    expect(g.day).toBe(0);
  });

  it('position: segment 1, 0 Mk in the segment, 0 Mk total (at Independence Station)', () => {
    expect([s.segment, s.distanceInSegment, s.distanceTotal]).toEqual([1, 0, 0]);
  });

  it('settings: Cruise, Full rations, Fair weather', () => {
    expect([s.thrust, s.rations, s.weather]).toEqual(['cruise', 'full', 'fair']);
  });

  it('counters start at zero / false / null', () => {
    expect([s.delayDays, s.strandedDays, s.consecutiveOverburn, s.consecutiveLowRations, s.eventCooldownUntilDay]).toEqual([0, 0, 0, 0, 0]);
    expect([s.scansThisSegment, s.justCrossedHazard, s.arrivedAt]).toEqual([0, false, null]);
    expect(s.deaths).toBe(0);
  });

  it('the log holds one departure line', () => {
    expect(s.log).toHaveLength(1);
    expect(s.log[0]!.kind).toBe('depart');
    expect(s.log[0]!.day).toBe(0);
  });

  it('status is "store" until the player leaves with at least one drive', () => {
    expect(s.status).toBe('store');
  });

  it('unknown profession or window is rejected', () => {
    expect(() => createGame({ profession: 'pirate' as ProfessionId, window: 1 }, createRng(1))).toThrow();
    expect(() => createGame({ profession: 'executive', window: 9 as WindowId }, createRng(1))).toThrow();
  });

  it('two new games with different rng seeds have identical state apart from log wording', () => {
    const a = createGame({ profession: 'engineer', window: 2 }, createRng(1));
    const b = createGame({ profession: 'engineer', window: 2 }, createRng(2));
    expect({ ...a, log: [] }).toEqual({ ...b, log: [] });
  });
});

describe('Crew names (world.md "Default names")', () => {
  it('defaults: Ezra, Temperance, Amos, Lucinda, Hollis', () => {
    expect(make().crew.map((c) => c.name)).toEqual(DEFAULTS);
    expect(normalizeCrewNames()).toEqual(DEFAULTS);
  });

  it('custom names are used in slot order', () => {
    expect(make('executive', 1, ['A', 'B', 'C', 'D', 'E']).crew.map((c) => c.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('an emptied (or blank) field reverts to its default', () => {
    expect(normalizeCrewNames(['', 'Bo', '   ']).slice(0, 4)).toEqual(['Ezra', 'Bo', 'Amos', 'Lucinda']);
  });

  it.each([['a', true], ['123456789012', true], ['1234567890123', false], ['', false], ['Zoë', false], ['tab\there', false], ['Mr. O\'Neil', true]])(
    'name %j valid=%s (1-12 printable ASCII characters)', (name, ok) => {
      expect(isValidName(name)).toBe(ok);
    });

  it('an invalid name reverts to the default for its slot', () => {
    expect(normalizeCrewNames(['Zoë', 'ThisNameIsFarTooLong'])).toEqual(DEFAULTS);
  });

  it('Random names: five distinct names from the 20-name pool', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const names = randomCrewNames(createRng(seed));
      expect(names).toHaveLength(5);
      expect(new Set(names).size).toBe(5);
      for (const n of names) expect(POOL).toContain(n);
    }
  });

  it('Random names eventually use the whole pool', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) for (const n of randomCrewNames(createRng(seed))) seen.add(n);
    expect([...seen].sort()).toEqual([...POOL].sort());
  });

  it('all default and pool names fit in 12 characters', () => {
    for (const n of [...DEFAULTS, ...POOL]) expect(isValidName(n)).toBe(true);
  });
});

describe('Flare season (world.md "Launch windows")', () => {
  it.each([['2184-09-14', false], ['2184-09-15', true], ['2184-09-16', true], ['2184-12-31', true], ['2184-03-01', false], ['2184-08-31', false]])(
    '%s is flare season: %s (begins 15 September 2184)', (date, yes) => {
      expect(isFlareSeason(date)).toBe(yes);
    });
});
