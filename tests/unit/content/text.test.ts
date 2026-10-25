import { describe, expect, it } from 'vitest';
import events from '../../../src/content/text/events.json';
import deaths from '../../../src/content/text/deaths.json';
import bulletins from '../../../src/content/text/bulletins.json';
import ui from '../../../src/content/text/ui.json';

const ALLOWED = new Set(['{name}', '{n}', '{item}']);
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
    const rest = { ...u, status: undefined, guide: undefined };
    checkStrings(collect(rest), 140, 'ui');
    for (const s of collect({ status: u.status })) expect(s.length).toBeGreaterThan(0);
  });
});
