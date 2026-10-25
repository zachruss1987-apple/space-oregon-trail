/** Memorial beacons (beacons.md): pure helpers. Storage lives in the UI; these take and return plain arrays. */
import { EPITAPH_TEXT, FINAL_WAYPOINT } from '@/content';
import type { Rng } from './rng';
import type { GameState } from './types';

/** A stored or canned beacon. */
export interface BeaconRecord {
  /** Waypoint index at the end of the leg where the death happened (1–15). */
  segment: number;
  /** Captain's name ("" for M1 records). */
  captain: string;
  /** The dead crew member. */
  name: string;
  /** Epitaph, 1–40 printable ASCII chars. */
  text: string;
  /** In-game ISO date. */
  date: string;
}

/** localStorage key and limits. */
export const BEACONS = { key: 'proxima.beacons', keep: 200, show: 3, textMax: 40, cannedFew: 2, cannedMany: 1, manyFrom: 10 } as const;

/** Segment for a beacon written now: `arrivedAt ?? segment`. */
export function beaconSegment(state: GameState): number {
  return state.arrivedAt ?? state.segment;
}

/** True for 1–40 printable ASCII characters (after trimming). */
export function isValidEpitaph(text: string): boolean {
  const t = text.trim();
  return t.length >= 1 && t.length <= BEACONS.textMax && /^[\x20-\x7e]+$/.test(t);
}

/** Build the record for a crew member's death (captain = crew[0]). */
export function makeBeacon(state: GameState, name: string, text: string): BeaconRecord {
  return { segment: beaconSegment(state), captain: state.crew[0]?.name ?? '', name, text: text.trim(), date: state.date };
}

/** Names of crew alive in `before` and dead in `after`, in roster order. */
export function newlyDead(before: GameState, after: GameState): string[] {
  return after.crew.filter((c, i) => !c.alive && before.crew[i]?.alive).map((c) => c.name);
}

/** The crew member who died most recently (latest diedOnDay, later roster slot on ties), or null. */
export function lastDeceased(state: GameState): string | null {
  let best: { name: string; day: number } | null = null;
  for (const c of state.crew) {
    if (!c.alive && c.diedOnDay !== null && (best === null || c.diedOnDay >= best.day)) best = { name: c.name, day: c.diedOnDay };
  }
  return best?.name ?? null;
}

/** Defensive parse of stored data: non-array → []; skips entries missing segment/name/text; missing captain → "". */
export function parseBeacons(raw: unknown): BeaconRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: BeaconRecord[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    if (typeof r['segment'] !== 'number' || typeof r['name'] !== 'string' || typeof r['text'] !== 'string') continue;
    out.push({
      segment: r['segment'],
      captain: typeof r['captain'] === 'string' ? r['captain'] : '',
      name: r['name'],
      text: r['text'],
      date: typeof r['date'] === 'string' ? r['date'] : '',
    });
  }
  return out;
}

/** Append (array order = recency) and keep the last 200. */
export function appendBeacon(list: readonly BeaconRecord[], b: BeaconRecord): BeaconRecord[] {
  return [...list, b].slice(-BEACONS.keep);
}

/** Canned beacons from epitaphs.json. */
export function cannedBeacons(): BeaconRecord[] {
  return parseBeacons(EPITAPH_TEXT['beacons']);
}

/**
 * Up to 3 beacons for waypoint `segment`: player beacons (most recent first), then canned picks (text Rng) filling at
 * most 2 slots while the player has < 10 beacons in total, else 1. New Willamette shows none.
 */
export function beaconsForSegment(
  player: readonly BeaconRecord[], segment: number, rng: Rng, canned: readonly BeaconRecord[] = cannedBeacons(),
): BeaconRecord[] {
  if (segment >= FINAL_WAYPOINT) return [];
  const own = player.filter((b) => b.segment === segment).reverse().slice(0, BEACONS.show);
  const room = Math.min(BEACONS.show - own.length, player.length < BEACONS.manyFrom ? BEACONS.cannedFew : BEACONS.cannedMany);
  const pool = canned.filter((b) => b.segment === segment);
  const picks: BeaconRecord[] = [];
  while (picks.length < room && pool.length > 0) picks.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
  return [...own, ...picks];
}

/** Display line: `Beacon: {name}, of Captain {captain}'s ship, {date}. "{text}"` (no captain → `Beacon: {name}, {date}. "{text}"`). */
export function formatBeacon(b: BeaconRecord): string {
  return b.captain
    ? `Beacon: ${b.name}, of Captain ${b.captain}'s ship, ${b.date}. "${b.text}"`
    : `Beacon: ${b.name}, ${b.date}. "${b.text}"`;
}
