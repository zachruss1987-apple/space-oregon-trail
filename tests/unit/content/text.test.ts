import { describe, expect, it } from 'vitest';
import events from '../../../src/content/text/events.json';
import deaths from '../../../src/content/text/deaths.json';
import bulletins from '../../../src/content/text/bulletins.json';
import ui from '../../../src/content/text/ui.json';
import stations from '../../../src/content/text/stations.json';
import trades from '../../../src/content/text/trades.json';
import epitaphs from '../../../src/content/text/epitaphs.json';
import { FALLBACK } from '../../../src/ui/copy';

const ALLOWED = new Set([
  '{name}', '{n}', '{item}',
  // UI-only placeholders filled by src/ui/copy.ts callers
  '{give}', '{get}', '{seed}', '{label}', '{total}', '{left}', '{mk}', '{health}', '{part}', '{cause}', '{rating}',
]);
const CONDITIONS = [
  'space-dysentery', 'hull-mold-fever', 'cryo-fever', 'scurvy',
  'radiation-sickness', 'exhaustion', 'decompression-injury', 'micrometeorite-puncture',
];
const EVENT_IDS = [
  'illness', 'pirates', 'lost_lane', 'drive_failure', 'drive_stall', 'hull_puncture',
  'pump_failure', 'gyro_failure', 'hull_fire', 'crew_eva_drift', 'bad_recycler',
  'derelict', 'algae_bloom', 'belter_help', 'cargo_shift', 'quiet_day',
  ...CONDITIONS.map((c) => `illness.${c}`),
];
const DEATH_KEYS = [...CONDITIONS, 'starvation', 'hazard', 'drift', 'hull_fire', 'adrift'];
const WAYPOINTS = [
  'independence-station', 'lunar-debris-ring', 'lagrange-shoals', 'mars-relay',
  'ceres-approach-spire', 'ceres-depot', 'jupiters-eye', 'the-belt-crossing',
  'europa-outpost', 'saturn-ring-plane', 'titan-refinery', 'kuiper-gate',
  'oort-beacon', 'proxima-heliopause-shock', 'lane-terminus-station',
  'the-flare-belt', 'new-willamette',
];
// Keys the sim requests via resolveText (events table). Fallbacks must never fire in play.
const WEATHER_IDS = ['calm', 'fair', 'unsettled', 'storm', 'fog', 'flare']; // src/sim/tick.ts weather.${id}
const SIM_EVENT_KEYS: Record<string, number> = {
  'scan.nothing': 2, 'scan.part': 2, 'scan.rations': 2, // src/sim/salvage.ts
  'repair.success': 2, 'repair.fail': 2, 'repair.failLost': 2, 'help.part': 2, 'help.drive': 2, // src/sim/repair.ts
  rejoin: 2, delay: 2, stuck: 2, starving: 2, suit_wear: 2, rest: 2, // src/sim/tick.ts, health.ts
  ...Object.fromEntries(WEATHER_IDS.map((w) => [`weather.${w}`, 3])), // src/sim/tick.ts
  ...Object.fromEntries(CONDITIONS.map((c) => [`recover.${c}`, 2])), // src/sim/health.ts recover.${cond.id}
};
// ui table keys: src/sim/tick.ts (arrival.*, death.allDead), src/sim/game.ts + store.ts (log.*)
const SIM_UI_KEYS = ['arrival.reached', 'arrival.final', 'death.allDead', 'log.departure', 'log.launch'];
const LOSS_WITH_QTY = ['pirates', 'cargo_shift', 'hull_fire'];

type Obj = Record<string, unknown>;
const entries = (o: unknown): [string, unknown][] =>
  Object.entries(o as Obj).filter(([k]) => k !== '$schema');

function checkStrings(all: string[], max: number, label: string): void {
  for (const s of all) {
    expect(typeof s).toBe('string');
    expect(s.trim().length, `${label}: empty string`).toBeGreaterThan(0);
    expect(s.length, `${label}: too long: ${s}`).toBeLessThanOrEqual(max);
    for (const p of s.match(/\{[^}]*\}/g) ?? []) {
      expect(ALLOWED.has(p), `${label}: bad placeholder ${p} in "${s}"`).toBe(true);
    }
  }
  const dupes = all.filter((s, i) => all.indexOf(s) !== i);
  expect(dupes, `${label}: duplicate strings`).toEqual([]);
}

function sentences(s: string): number {
  return (s.match(/[.!?](\s|$)/g) ?? []).length;
}

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Obj)) if (k !== '$schema') collect(x, out);
  }
  return out;
}

describe('events.json', () => {
  it('has every required key with non-empty string arrays', () => {
    for (const id of EVENT_IDS) {
      const v = (events as Obj)[id] as string[];
      expect(Array.isArray(v), id).toBe(true);
      expect(v.length, id).toBeGreaterThanOrEqual(id === 'quiet_day' ? 20 : 3);
    }
    for (const [, v] of entries(events)) expect(Array.isArray(v) && v.length > 0).toBe(true);
  });
  it('strings are short, unique, and use allowed placeholders', () => {
    checkStrings(collect(events), 140, 'events');
  });
  it('are at most two sentences', () => {
    for (const s of collect(events)) expect(sentences(s), s).toBeLessThanOrEqual(2);
  });
  it('loss events show the number lost; crew events name the crew', () => {
    for (const id of LOSS_WITH_QTY) {
      for (const s of (events as Obj)[id] as string[]) {
        expect(/\{n\}|\{item\}/.test(s), s).toBe(true);
      }
    }
    for (const id of ['hull_fire', 'crew_eva_drift', 'illness']) {
      for (const s of (events as Obj)[id] as string[]) expect(s).toContain('{name}');
    }
    for (const c of CONDITIONS) {
      for (const s of (events as Obj)[`illness.${c}`] as string[]) expect(s).toContain('{name}');
    }
  });
});

describe('sim-requested keys', () => {
  const get = (root: unknown, key: string): unknown =>
    (root as Obj)[key] ?? key.split('.').reduce<unknown>((a, p) => (a as Obj | undefined)?.[p], root);
  it('events.json covers every key the sim asks for', () => {
    for (const [k, min] of Object.entries(SIM_EVENT_KEYS)) {
      const v = get(events, k);
      expect(Array.isArray(v), k).toBe(true);
      expect((v as string[]).length, k).toBeGreaterThanOrEqual(min);
      if (k.startsWith('weather.')) for (const s of v as string[]) expect(s.length, s).toBeLessThanOrEqual(90);
      if (k.startsWith('recover.')) for (const s of v as string[]) expect(s).toContain('{name}');
    }
  });
  it('ui.json covers every key the sim asks for', () => {
    for (const k of SIM_UI_KEYS) {
      const v = get(ui, k);
      expect(typeof v === 'string' || Array.isArray(v), k).toBe(true);
    }
    for (const k of ['arrival.reached', 'log.departure']) {
      for (const s of get(ui, k) as string[]) expect(s).toContain('{name}');
    }
    expect((get(ui, 'arrival.reached') as string[]).length).toBeGreaterThanOrEqual(2);
    expect((get(ui, 'arrival.final') as string[]).length).toBeGreaterThanOrEqual(2);
    expect((get(ui, 'log.launch') as string[]).length).toBeGreaterThanOrEqual(2);
    expect((get(ui, 'log.departure') as string[]).length).toBeGreaterThanOrEqual(2);
  });
});

describe('deaths.json', () => {
  it('has every cause with 3+ variants', () => {
    for (const k of DEATH_KEYS) {
      const v = (deaths as Obj)[k] as string[];
      expect(Array.isArray(v), k).toBe(true);
      expect(v.length, k).toBeGreaterThanOrEqual(3);
      for (const s of v) {
        if (k === 'adrift') expect(s).not.toContain('{name}');
        else expect(s).toContain('{name}');
      }
    }
  });
  it('strings are short, unique, and use allowed placeholders', () => {
    checkStrings(collect(deaths), 140, 'deaths');
  });
});

describe('bulletins.json', () => {
  it('has all 17 waypoints with blurb and 3+ lines', () => {
    for (const id of WAYPOINTS) {
      const w = (bulletins as Obj)[id] as { blurb: string; lines: string[] };
      expect(w, id).toBeDefined();
      expect(typeof w.blurb).toBe('string');
      expect(w.blurb.length, id).toBeLessThanOrEqual(200);
      expect(Array.isArray(w.lines)).toBe(true);
      expect(w.lines.length, id).toBeGreaterThanOrEqual(3);
      for (const l of w.lines) expect(l.length, l).toBeLessThanOrEqual(140);
    }
  });
  it('blurbs and lines are unique and use allowed placeholders', () => {
    const all: string[] = [];
    for (const [, w] of entries(bulletins)) {
      const x = w as { blurb: string; lines: string[] };
      all.push(x.blurb, ...x.lines);
    }
    checkStrings(all, 200, 'bulletins');
  });
});

describe('ui.json', () => {
  const u = ui as unknown as Obj;
  it('keeps the canonical menus', () => {
    expect((u.title as Obj).menu).toEqual(['Travel the Trail', 'Learn about the Trail', 'See the Top Ten', 'Options']);
    expect((u.travel as Obj).menu).toEqual([
      'Continue on the Lane', 'Check supplies', 'Look at the map', 'Change thrust',
      'Change rations', 'Rest', 'Attempt repair', 'Scan for salvage',
    ]);
  });
  it('has required sections', () => {
    for (const k of ['title', 'travel', 'setup', 'mattie', 'status', 'crossing', 'arrival', 'death', 'guide']) {
      expect(u[k], k).toBeDefined();
    }
    const setup = u.setup as { windows: string[]; professions: Obj };
    expect(setup.windows).toHaveLength(5);
    for (const w of setup.windows) expect(w.length).toBeLessThanOrEqual(100);
    expect(Object.keys(setup.professions)).toHaveLength(3);
    const mattie = u.mattie as { advice: string[]; greeting: string; confirm: string; cantAfford: string };
    expect(mattie.advice.length).toBeGreaterThanOrEqual(12);
    for (const k of ['greeting', 'confirm', 'cantAfford'] as const) expect(mattie[k].length).toBeGreaterThan(0);
    const crossing = u.crossing as Obj;
    for (const k of ['scraped', 'cargo', 'damage', 'injury', 'lost']) {
      expect((crossing[k] as string[]).length, k).toBeGreaterThanOrEqual(2);
    }
    for (const s of crossing.cargo as string[]) expect(/\{n\}/.test(s) && /\{item\}/.test(s)).toBe(true);
    for (const k of ['injury', 'lost']) for (const s of crossing[k] as string[]) expect(s).toContain('{name}');
    const ratings = (u.arrival as { ratings: Obj }).ratings;
    expect(Object.keys(ratings).sort()).toEqual(['Groundling', 'Pathfinder', 'Spacer']);
  });
  it('strings are short, nonempty, and use allowed placeholders', () => {
    // status labels repeat by design (Fair is both weather and health), so exclude them from uniqueness
    const guide = (u.guide as { body: string }).body;
    expect(guide.length).toBeLessThanOrEqual(400);
    // Labels FALLBACK once covered repeat by design (Credits, Continue on the Lane), so skip uniqueness.
    const rest = structuredClone(u) as Obj;
    delete rest.status;
    delete rest.guide;
    for (const k of Object.keys(FALLBACK)) {
      const parts = k.split('.');
      const parent = parts.slice(0, -1).reduce<Obj | undefined>((a, p) => a?.[p] as Obj | undefined, rest);
      if (parent) delete parent[parts[parts.length - 1] as string];
    }
    checkStrings(collect(rest), 140, 'ui');
    for (const k of Object.keys(FALLBACK)) {
      const v = k.split('.').reduce<unknown>((a, p) => (a as Obj | undefined)?.[p], u);
      if (k !== 'store.header') expect((v as string).length, k).toBeLessThanOrEqual(90);
    }
    for (const s of collect({ status: u.status })) expect(s.length).toBeGreaterThan(0);
  });
});

describe('ui.json vs FALLBACK', () => {
  it('resolves every FALLBACK key so the fallback never fires', () => {
    for (const [k, fallback] of Object.entries(FALLBACK)) {
      const v = k.split('.').reduce<unknown>((a, p) => (a as Obj | undefined)?.[p], ui);
      expect(typeof v, k).toBe('string');
      const ph = (s: string) => (s.match(/{[^}]*}/g) ?? []).sort();
      expect(ph(v as string), k).toEqual(ph(fallback));
    }
  });
});

describe('stations.json (T-024)', () => {
  const IDS = [
    'independence-station', 'mars-relay', 'ceres-depot', 'europa-outpost',
    'titan-refinery', 'oort-beacon', 'lane-terminus-station',
  ];
  it('has 10+ talk lines for each of the 7 stations, all known to bulletins.json', () => {
    const ids = entries(stations).map(([k]) => k).sort();
    expect(ids).toEqual([...IDS].sort());
    for (const id of ids) {
      expect((bulletins as Obj)[id], id).toBeDefined();
      const talk = ((stations as Obj)[id] as { talk: string[] }).talk;
      expect(Array.isArray(talk), id).toBe(true);
      expect(talk.length, id).toBeGreaterThanOrEqual(10);
    }
  });
  it('lines are short, unique across the file, and placeholder-free', () => {
    const all = collect(stations);
    checkStrings(all, 140, 'stations');
    for (const s of all) expect(s, s).not.toMatch(/\{/);
    const lanes = collect(bulletins);
    for (const s of all) expect(lanes, s).not.toContain(s);
  });
});

describe('trades.json (T-024)', () => {
  const personas = Object.entries((trades as { personas: Record<string, Obj> }).personas);
  it('has 20+ personas with name and 2+ variants per line type', () => {
    expect(personas.length).toBeGreaterThanOrEqual(20);
    for (const [id, p] of personas) {
      expect(typeof p.name, id).toBe('string');
      for (const k of ['offer', 'accept', 'decline']) {
        expect((p[k] as string[]).length, `${id}.${k}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it('offers use exactly {give} and {get}; replies use no placeholders', () => {
    for (const [id, p] of personas) {
      for (const s of p.offer as string[]) {
        expect(s, id).toContain('{give}');
        expect(s, id).toContain('{get}');
        expect((s.match(/\{[^}]*\}/g) ?? []).every((x) => x === '{give}' || x === '{get}'), s).toBe(true);
      }
      for (const s of [...(p.accept as string[]), ...(p.decline as string[])]) expect(s, s).not.toMatch(/\{/);
    }
  });
  it('strings are short and unique', () => {
    const all = personas.flatMap(([, p]) => [p.name as string, ...(p.offer as string[]), ...(p.accept as string[]), ...(p.decline as string[])]);
    const nonPh = all.filter((s) => !/\{/.test(s));
    checkStrings(nonPh, 140, 'trades');
    for (const s of all) expect(s.length, s).toBeLessThanOrEqual(140);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('epitaphs.json (T-024)', () => {
  const canned = (epitaphs as { beacons: { name: string; text: string; segment: number; captain: string; date: string }[] }).beacons;
  it('has 40+ canned beacons with names, short text, captain, date, and segments 1-15', () => {
    expect(canned.length).toBeGreaterThanOrEqual(40);
    for (const e of canned) {
      expect(e.name.length, e.name).toBeGreaterThan(0);
      expect(e.name.length, e.name).toBeLessThanOrEqual(12);
      expect(e.text.length, e.text).toBeLessThanOrEqual(40);
      expect(e.captain.length, e.text).toBeGreaterThan(0);
      expect(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(e.date) && e.date < "2184-03-01", e.text).toBe(true);
      expect(Number.isInteger(e.segment) && e.segment >= 1 && e.segment <= 15, e.text).toBe(true);
    }
  });
  it('texts are unique and cover the hazard segments', () => {
    checkStrings(canned.map((e) => e.text), 40, 'epitaphs');
    const segs = new Set(canned.map((e) => e.segment));
    for (let h = 1; h <= 15; h++) expect(segs.has(h), `segment ${h}`).toBe(true);
    for (const h of [1, 2, 7, 9, 13, 15]) {
      expect(canned.filter((e) => e.segment === h).length, `hazard segment ${h}`).toBeGreaterThanOrEqual(3);
    }
  });
});
