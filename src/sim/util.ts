/** Small pure helpers shared by sim modules. */
import { FLARE_SEASON_START, HEALTH_BANDS, MAX_CONDITIONS, type HealthLabel } from '@/content';
import type { Rng } from './rng';
import type { Crew, GameState, LogEntry, LogKind } from './types';

/** ISO date + n days (UTC, no wall clock involved). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** True on or after 15 September 2184. */
export function isFlareSeason(iso: string): boolean {
  return iso >= FLARE_SEASON_START;
}

/** Alive and aboard. */
export function isPresent(c: Crew): boolean {
  return c.alive && c.awayDays === 0;
}

/** Present crew in roster order. */
export function presentCrew(state: GameState): Crew[] {
  return state.crew.filter(isPresent);
}

/** Living crew (present or away). */
export function livingCrew(state: GameState): Crew[] {
  return state.crew.filter((c) => c.alive);
}

/** Label for a health number. */
export function healthLabel(health: number): HealthLabel {
  return (HEALTH_BANDS.find((b) => health >= b.min) ?? HEALTH_BANDS[HEALTH_BANDS.length - 1]!).label;
}

/** Average health of living crew (0 if none). */
export function averageHealth(state: GameState): number {
  const living = livingCrew(state);
  return living.length === 0 ? 0 : living.reduce((s, c) => s + c.health, 0) / living.length;
}

/** Ship-wide general health label. */
export function generalHealth(state: GameState): HealthLabel {
  return healthLabel(averageHealth(state));
}

/** Drives that can push today. */
export function workingDrives(state: GameState): number {
  return Math.max(0, state.supplies.drives - state.offlineDrives.length);
}

/** Can this crew member take a new condition `id`? */
export function hasRoom(c: Crew, id?: string): boolean {
  return c.conditions.length < MAX_CONDITIONS && (id === undefined || !c.conditions.some((x) => x.id === id));
}

/** `floor(qty × pct/100)`, min 1 when qty > 0. */
export function pctLoss(qty: number, pct: number): number {
  if (qty <= 0) return 0;
  return Math.min(qty, Math.max(1, Math.floor((qty * pct) / 100)));
}

/** Inclusive integer from a [min, max] tuple. */
export function roll(rng: Rng, range: readonly [number, number]): number {
  return rng.int(range[0], range[1]);
}

/** Append a log entry to state (mutates) and to the collector. */
export function pushLog(state: GameState, out: LogEntry[], kind: LogKind, text: string, id?: string): void {
  const entry: LogEntry = id === undefined ? { day: state.day, kind, text } : { day: state.day, kind, text, id };
  state.log.push(entry);
  out.push(entry);
}

/** Copy of a state deep enough that mutating the copy never touches the original. Log entries are immutable and shared. */
export function cloneState(state: GameState): GameState {
  return {
    ...state,
    crew: state.crew.map((c) => ({ ...c, conditions: c.conditions.map((x) => ({ ...x })) })),
    supplies: { ...state.supplies },
    broken: { ...state.broken },
    offlineDrives: [...state.offlineDrives],
    log: [...state.log],
  };
}
