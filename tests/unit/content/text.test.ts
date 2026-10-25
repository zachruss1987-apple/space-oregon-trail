import { describe, expect, it } from 'vitest';
import events from '../../../src/content/text/events.json';
import deaths from '../../../src/content/text/deaths.json';
import bulletins from '../../../src/content/text/bulletins.json';
import ui from '../../../src/content/text/ui.json';
import stations from '../../../src/content/text/stations.json';
import trades from '../../../src/content/text/trades.json';
import epitaphs from '../../../src/content/text/epitaphs.json';
import guide from '../../../src/content/text/guide.json';
import highscores from '../../../src/content/text/highscores.json';
import { FALLBACK, PENDING } from '../../../src/ui/copy';

const ALLOWED = new Set([
  '{name}', '{n}', '{item}',
  // UI-only placeholders filled by src/ui/copy.ts callers
  '{captain}', '{cr}', '{captain}', '{cr}', '{give}', '{get}', '{seed}', '{label}', '{total}', '{left}', '{mk}', '{health}', '{part}', '{cause}', '{rating}', '{parts}', '{hits}',
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
    const guideIntro = (u.guide as { intro: string }).intro;
    expect(guideIntro.length).toBeLessThanOrEqual(400);
    // Labels FALLBACK once covered repeat by design (Credits, Continue on the Lane), so skip uniqueness.
    const rest = structuredClone(u) as Obj;
    delete rest.status;
    delete rest.guide;
    for (const k of [...Object.keys(FALLBACK), ...Object.keys(PENDING)]) {
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

describe('ui.json vs PENDING (T-054)', () => {
  it('resolves every PENDING key as a string with the same placeholders', () => {
    const ph = (x: string) => (x.match(/{[^}]*}/g) ?? []).sort();
    for (const [k, pending] of Object.entries(PENDING)) {
      const v = k.split('.').reduce<unknown>((a, p) => (a as Obj | undefined)?.[p], ui);
      expect(typeof v, k).toBe('string');
      expect(ph(v as string), k).toEqual(ph(pending));
      expect((v as string).length, k).toBeLessThanOrEqual(90);
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
    const talkLines = entries(stations).flatMap(([, v]) => (v as { talk: string[] }).talk);
    for (const s of talkLines) expect(s, s).not.toMatch(/\{/);
    const lanes = collect(bulletins);
    for (const s of all) expect(lanes, s).not.toContain(s);
  });
});

describe('stations.json keeper and greeting (T-052)', () => {
  type Station = { keeper: string; greeting: string[]; talk: string[] };
  const all = entries(stations) as [string, Station][];
  it('every station has a keeper (<= 24 chars) and 2+ greetings, each with {captain}', () => {
    expect(all).toHaveLength(7);
    for (const [id, st] of all) {
      expect(typeof st.keeper, id).toBe('string');
      expect(st.keeper.length, id).toBeGreaterThan(0);
      expect(st.keeper.length, id).toBeLessThanOrEqual(24);
      expect(st.greeting.length, id).toBeGreaterThanOrEqual(2);
      for (const g of st.greeting) {
        expect(g, g).toContain('{captain}');
        expect(g.match(/{[^}]*}/g)).toEqual(['{captain}']);
      }
    }
  });
  it('keepers are unique', () => {
    const names = all.map(([, st]) => st.keeper);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('ui.json station log and interim keys (T-052)', () => {
  const get = (key: string): unknown => key.split('.').reduce<unknown>((a, p) => (a as Obj | undefined)?.[p], ui);
  const phs = (s: string) => [...new Set(s.match(/{[^}]*}/g) ?? [])].sort();
  // key -> placeholders every variant must contain (src/sim/market.ts, actions.ts; hazard.option.rest in WaypointScene)
  const REQUIRED: Record<string, string[]> = {
    'station.log.bought': ['{cr}', '{item}'],
    'station.log.sold': ['{cr}', '{item}'],
    'log.thrustSet': ['{name}'],
    'log.rationsSet': ['{name}'],
    'log.repairStart': ['{part}'],
    'hazard.option.rest': [],
  };
  it('has every required key with its placeholder set', () => {
    for (const [k, want] of Object.entries(REQUIRED)) {
      const v = get(k);
      const variants = typeof v === 'string' ? [v] : (v as string[]);
      expect(Array.isArray(variants) && variants.length > 0, k).toBe(true);
      for (const line of variants) {
        expect(phs(line), k + ': ' + line).toEqual(want);
        expect(line.length, k).toBeLessThanOrEqual(140);
      }
    }
  });
  it('interim labels fit the 24-char menu limit', () => {
    for (const k of ['hazard.option.rest', 'hazard.option.thread', 'hazard.option.tug']) expect((get(k) as string).length, k).toBeLessThanOrEqual(24);
  });
});

describe('stations.json keeper and greeting (T-052)', () => {
  type Station = { keeper: string; greeting: string[]; talk: string[] };
  const all = entries(stations) as [string, Station][];
  it('every station has a keeper (<= 24 chars) and 2+ greetings, each with only {captain}', () => {
    expect(all).toHaveLength(7);
    for (const [id, st] of all) {
      expect(typeof st.keeper, id).toBe('string');
      expect(st.keeper.length, id).toBeGreaterThan(0);
      expect(st.keeper.length, id).toBeLessThanOrEqual(24);
      expect(st.greeting.length, id).toBeGreaterThanOrEqual(2);
      for (const g of st.greeting) {
        expect(g, g).toContain('{captain}');
        expect(g.match(/{[^}]*}/g)).toEqual(['{captain}']);
      }
    }
  });
  it('keepers are unique', () => {
    const names = all.map(([, st]) => st.keeper);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('ui.json station log and interim keys (T-052)', () => {
  const get = (key: string): unknown => key.split('.').reduce<unknown>((a, p) => (a as Obj | undefined)?.[p], ui);
  const phs = (s: string) => [...new Set(s.match(/{[^}]*}/g) ?? [])].sort();
  // key -> placeholders every variant must contain (src/sim/market.ts, actions.ts; hazard.option.rest in WaypointScene)
  const REQUIRED: Record<string, string[]> = {
    'station.log.bought': ['{cr}', '{item}'],
    'station.log.sold': ['{cr}', '{item}'],
    'log.thrustSet': ['{name}'],
    'log.rationsSet': ['{name}'],
    'log.repairStart': ['{part}'],
    'hazard.option.rest': [],
  };
  it('has every required key with its placeholder set', () => {
    for (const [k, want] of Object.entries(REQUIRED)) {
      const v = get(k);
      const variants = typeof v === 'string' ? [v] : (v as string[]);
      expect(Array.isArray(variants) && variants.length > 0, k).toBe(true);
      for (const line of variants) {
        expect(phs(line), k + ': ' + line).toEqual(want);
        expect(line.length, k).toBeLessThanOrEqual(140);
      }
    }
  });
  it('interim labels fit the 24-char menu limit', () => {
    for (const k of ['hazard.option.rest', 'hazard.option.thread', 'hazard.option.tug']) expect((get(k) as string).length, k).toBeLessThanOrEqual(24);
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

describe('mini-game text keys (T-056, minigames.md "Log kinds (new)" text keys)', () => {
  const get = (t: unknown, key: string): unknown => key.split('.').reduce<unknown>((a, p) => (a as Obj | undefined)?.[p], t);
  const variants = (t: unknown, k: string): string[] => {
    const v = get(t, k) ?? (t as Obj)[k];
    return typeof v === 'string' ? [v] : (v as string[]);
  };
  const phs = (s: string) => [...new Set(s.match(/{[^}]*}/g) ?? [])].sort();
  // events.json: log lines the sim resolves (kinds salvage / threading / flare / info); key -> exact placeholder set
  const EVENT_KEYS: Record<string, string[]> = {
    'salvage.haul': ['{n}', '{parts}'], 'salvage.haulRations': ['{n}'], 'salvage.haulParts': ['{parts}'],
    'salvage.nothing': [], 'salvage.wrecked': [], 'salvage.hot': ['{name}'], 'salvage.overweight': ['{n}'],
    'threading.clean': [], 'threading.hit': ['{hits}'],
    'flare.clean': [], 'flare.scorch': ['{item}', '{n}'], 'flare.burn': ['{name}'],
    'flare.damage': ['{item}'], 'flare.radiation': ['{name}'], 'flare.crash': ['{name}'],
    'info.skipped': [],
  };
  it('events.json has each log key, 2+ variants, <= 140 chars, exact placeholders', () => {
    for (const [k, want] of Object.entries(EVENT_KEYS)) {
      const v = variants(events, k);
      expect(v.length, k).toBeGreaterThanOrEqual(2);
      for (const line of v) {
        expect(phs(line), `${k}: ${line}`).toEqual(want);
        expect(line.length, k).toBeLessThanOrEqual(140);
      }
    }
  });
  // ui.json scene copy; labels (single strings tagged L) must fit 24 chars
  const UI_KEYS: Record<string, string[]> = {
    'minigame.countdown': [], 'minigame.paused': [], 'minigame.skip': [], 'minigame.controls': [],
    'minigame.resultTitle': [], 'minigame.bonusPick': [], 'minigame.holdFull': [], 'minigame.outOfCharges': [],
    'minigame.common.go': [], 'minigame.common.resume': [], 'minigame.common.time': ['{n}'], 'minigame.common.continue': [],
    'minigame.common.skipConfirm': [], 'minigame.common.skipYes': [], 'minigame.common.skipNo': [],
    'minigame.common.autoNotice': [], 'minigame.common.controlsBody': [],
    'minigame.salvage.title': [], 'minigame.salvage.howto': [], 'minigame.salvage.start': [],
    'minigame.salvage.hudCharges': ['{n}'], 'minigame.salvage.hudHold': ['{n}'], 'minigame.salvage.hudHp': ['{n}'],
    'minigame.salvage.resultHaul': ['{n}', '{parts}'], 'minigame.salvage.resultNothing': [],
    'minigame.salvage.droneWrecked': [], 'minigame.salvage.chargesUsed': ['{n}'], 'minigame.salvage.confirm': [],
    'minigame.threading.title': [], 'minigame.threading.howto': [], 'minigame.threading.start': [],
    'minigame.threading.hudHits': ['{hits}'], 'minigame.threading.resultClean': [], 'minigame.threading.resultHits': ['{hits}'],
    'minigame.threading.bonusHealth': [], 'minigame.threading.bonusRations': [],
    'minigame.flare.title': [], 'minigame.flare.howto': [], 'minigame.flare.start': [], 'minigame.flare.hudHits': ['{hits}'],
    'minigame.flare.crash': [], 'minigame.flare.rodeTheWind': [], 'minigame.flare.rodeTheWindLog': [],
    'score.labels.rodeTheWind': [],
  };
  const LABELS = ['minigame.skip', 'minigame.controls', 'minigame.common.resume', 'minigame.common.skipYes', 'minigame.common.skipNo',
    'minigame.salvage.title', 'minigame.threading.title', 'minigame.flare.title', 'minigame.salvage.hudCharges',
    'minigame.threading.hudHits', 'minigame.flare.hudHits', 'minigame.threading.bonusHealth', 'minigame.threading.bonusRations',
    'minigame.flare.rodeTheWind', 'score.labels.rodeTheWind'];
  it('ui.json has every mini-game key with its placeholder set and length limits', () => {
    for (const [k, want] of Object.entries(UI_KEYS)) {
      const v = variants(ui, k);
      expect(Array.isArray(v) && v.length > 0, k).toBe(true);
      for (const line of v) {
        expect(phs(line), `${k}: ${line}`).toEqual(want);
        expect(line.length, k).toBeLessThanOrEqual(140);
      }
    }
    for (const k of ['minigame.salvage.howto', 'minigame.threading.howto', 'minigame.flare.howto']) {
      expect(variants(ui, k), k).toHaveLength(3);
    }
    expect(variants(ui, 'minigame.flare.rodeTheWindLog').length).toBeGreaterThanOrEqual(2);
  });
  it('ui.json has the T-058 formerly-unwritten keys', () => {
    const want: Record<string, string[]> = {
      'minigame.common.fire': [], 'minigame.common.pauseIcon': [], 'minigame.common.countdownN': ['{n}'],
      'minigame.salvage.resultRations': ['{n}'], 'minigame.salvage.resultParts': ['{parts}'],
      'minigame.salvage.scrap': [], 'minigame.salvage.snap': [], 'minigame.salvage.hit': [],
      'minigame.salvage.hot': [], 'minigame.salvage.blip': [],
      'title.miniAuto': [], 'title.miniPlay': [],
    };
    for (const [k, ph] of Object.entries(want)) {
      const v = variants(ui, k);
      expect(v.length, k).toBeGreaterThan(0);
      for (const line of v) {
        expect(phs(line), k).toEqual(ph);
        expect(line.length, k).toBeLessThanOrEqual(90);
      }
    }
    for (const k of ['minigame.common.fire', 'minigame.common.pauseIcon', 'minigame.common.countdownN', 'minigame.salvage.blip']) {
      for (const line of variants(ui, k)) expect(line.length, k).toBeLessThanOrEqual(24);
    }
  });
  it('mini-game labels fit 24 chars', () => {
    for (const k of LABELS) for (const line of variants(ui, k)) expect(line.length, k).toBeLessThanOrEqual(24);
  });
});

describe('guide.json and highscores.json (T-042)', () => {
  const pages = (guide as { pages: { title: string; body: string[] }[] }).pages;
  it('has 8-12 guide pages with short titles and fitting lines', () => {
    expect(pages.length).toBeGreaterThanOrEqual(8);
    expect(pages.length).toBeLessThanOrEqual(12);
    for (const p of pages) {
      expect(p.title.length, p.title).toBeGreaterThan(0);
      expect(p.title.length, p.title).toBeLessThanOrEqual(32);
      expect(p.body.length, p.title).toBeGreaterThanOrEqual(8);
      expect(p.body.length, p.title).toBeLessThanOrEqual(14);
      for (const l of p.body) {
        expect(l.trim().length, p.title).toBeGreaterThan(0);
        expect(l.length, l).toBeLessThanOrEqual(72);
      }
    }
  });
  const hs = (highscores as { defaults: { name: string; profession: string; score: number; days: number; date: string }[] }).defaults;
  it('has ten default crews, descending, Spacer at best', () => {
    expect(hs).toHaveLength(10);
    for (let i = 1; i < hs.length; i++) expect(hs[i]!.score).toBeLessThan(hs[i - 1]!.score);
    expect(hs[0]!.score).toBeGreaterThanOrEqual(3000);
    expect(hs[0]!.score).toBeLessThan(6000);
    for (const h of hs) {
      expect(['executive', 'engineer', 'farmer']).toContain(h.profession);
      expect(h.name.length).toBeGreaterThan(0);
      expect(h.name.length).toBeLessThanOrEqual(12);
      expect(h.days).toBeGreaterThan(0);
      expect(h.date).toMatch(/^2184-\d\d-\d\d$/);
      expect(Number.isNaN(Date.parse(h.date))).toBe(false);
    }
    expect(new Set(hs.map((h) => h.name)).size).toBe(10);
  });
  it('ui.json has guide and topTen keys', () => {
    const g = (ui as unknown as Obj).guide as Obj;
    for (const k of ['title', 'hint', 'pageOf', 'intro']) expect(typeof g[k], k).toBe('string');
    expect(g.pageOf).toBe('Page {n} of {total}');
    const t = (ui as unknown as Obj).topTen as Obj;
    for (const k of ['title', 'empty', 'header', 'yourRun']) expect(typeof t[k], k).toBe('string');
    expect((t.header as string).length).toBeLessThanOrEqual(72);
  });
});
