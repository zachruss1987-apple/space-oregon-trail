/** M2 hazard crossings (hazards.md): today's density, the four methods, availability, risk words, resolution. */
import { CROSSING, HAZARD, PART_NAMES, ROUTE, WAYPOINTS, type Waypoint } from '@/content';
import { incidentChance, rollCrossing, resolveCrossing, type CrossingOutcome } from './hazard';
import type { Rng } from './rng';
import { resolveText, textLine } from './text';
import type { CrossMethod, Crossing, GameState, LogEntry } from './types';
import { isFlareSeason, pushLog, roundHalfUp, workingDrives } from './util';

/** All methods in menu order. */
export const CROSS_METHODS: readonly CrossMethod[] = ['thread', 'shields', 'tug', 'pilot'];

/** Risk words for the readout. */
export type RiskId = (typeof CROSSING.risk)[number]['id'];
/** Density trend vs nominal. */
export type DensityTrend = 'thinner' | 'usual' | 'thicker';

/** True at The Flare Belt (M2 fallback: M1 Thread roll or a tug). */
export function isFlareBelt(w: Waypoint): boolean {
  return w.id === HAZARD.flareBeltId;
}

/** Today's density on arrival: d100 → nominal −1 / nominal / +1 (25/50/25), clamped 1–5. The Flare Belt is 5 with no draw. */
export function rollDensity(w: Waypoint, rng: Rng): number {
  const nominal = w.hazard?.density ?? CROSSING.densityMax;
  if (isFlareBelt(w)) return CROSSING.densityMax;
  const d100 = rng.int(1, 100);
  const shift = d100 <= CROSSING.densityRoll.thinnerMax ? -1 : d100 <= CROSSING.densityRoll.usualMax ? 0 : 1;
  return Math.max(CROSSING.densityMin, Math.min(CROSSING.densityMax, nominal + shift));
}

/** 1 + 0.2 × (density − nominal). */
export function densityFactor(density: number, nominal: number): number {
  return 1 + CROSSING.densityStep * (density - nominal);
}

/** Density trend word id for the readout. */
export function densityTrend(c: Crossing): DensityTrend {
  const nominal = WAYPOINTS[c.waypoint]!.hazard?.density ?? c.density;
  return c.density < nominal ? 'thinner' : c.density > nominal ? 'thicker' : 'usual';
}

/** baseline + window + route (+10 Heliopause when direct) + flare season (Flare Belt). */
export function baseIncident(state: GameState, w: Waypoint): number {
  const routeBonus = w.id === ROUTE.heliopauseId && state.route === 'direct' ? ROUTE.directIncidentBonus : 0;
  return incidentChance(state, w) + routeBonus;
}

/** Ship modifier: +10 each for a broken hull, a broken gyro, ≤ 1 working drive. */
export function shipModifier(state: GameState): number {
  let m = 0;
  if (state.broken.hull) m += CROSSING.shipPenalty;
  if (state.broken.gyro) m += CROSSING.shipPenalty;
  if (workingDrives(state) <= CROSSING.shipDrivesAtMost) m += CROSSING.shipPenalty;
  return m;
}

/** Tug price here today (×1.5 in flare season, half up). */
export function tugPrice(state: GameState, w: Waypoint): number {
  const base = w.hazard?.tugPrice ?? 0;
  return isFlareSeason(state.date) ? roundHalfUp(base * CROSSING.tugFlareFactor) : base;
}

/** Incident chance (percent) of a method for the pending crossing; null if the method is not offered here. */
export function crossChance(state: GameState, method: CrossMethod, c: Crossing | null = state.crossing): number | null {
  if (!c) return null;
  const w = WAYPOINTS[c.waypoint]!;
  const flare = isFlareBelt(w);
  const thread = flare
    ? incidentChance(state, w)
    : Math.min(CROSSING.maxIncident, roundHalfUp(baseIncident(state, w) * densityFactor(c.density, w.hazard!.density)) + shipModifier(state));
  switch (method) {
    case 'thread': return thread;
    case 'shields': return flare ? null : roundHalfUp(thread * CROSSING.shields.factor);
    case 'tug': return 0;
    case 'pilot': return flare || w.hazard?.pilotWait == null ? null : CROSSING.pilot.incident;
  }
}

/** Risk word id from an incident chance: 0 None, 1–9 Low, 10–24 Moderate, 25–44 High, ≥ 45 Severe. */
export function riskWord(pct: number): RiskId {
  return (CROSSING.risk.find((r) => pct <= r.max) ?? CROSSING.risk[CROSSING.risk.length - 1]!).id;
}

/** Display label for a risk word (ui.json `hazard.risk.*`). */
export function riskLabel(pct: number): string {
  const id = riskWord(pct);
  return textLine('ui', `hazard.risk.${id}`, id.charAt(0).toUpperCase() + id.slice(1));
}

const BLOCKED: Record<string, string> = {
  cantMove: 'Your ship cannot move.',
  noTug: 'You cannot afford a tug.',
  noPilot: 'You cannot afford a pilot.',
  noBelters: 'No Belters work this stretch.',
  notHere: 'Not in this weather.',
  chooseFirst: 'Choose how to cross first.',
  pilotSent: 'You already sent for a pilot.',
};

/** Refusal message for a `hazard.blocked.*` id (writer text, spec fallback). */
export function blockedText(id: keyof typeof BLOCKED): string {
  return textLine('ui', `hazard.blocked.${id}`, BLOCKED[id]!);
}

/** Why `method` cannot be chosen now, or null. */
export function crossBlocker(state: GameState, method: CrossMethod): string | null {
  const c = state.crossing;
  if (!c) return 'There is nothing to cross.';
  if (!CROSS_METHODS.includes(method)) return 'Unknown method.';
  const w = WAYPOINTS[c.waypoint]!;
  if (c.pilotDaysLeft !== null && c.pilotDaysLeft > 0 && method !== 'pilot') return blockedText('pilotSent');
  switch (method) {
    case 'shields':
    case 'thread':
      if (method === 'shields' && isFlareBelt(w)) return blockedText('notHere');
      return workingDrives(state) < 1 || state.broken.pump ? blockedText('cantMove') : null;
    case 'tug':
      return state.credits + 1e-9 < tugPrice(state, w) ? blockedText('noTug') : null;
    case 'pilot':
      if (isFlareBelt(w)) return blockedText('notHere');
      if (w.hazard?.pilotWait == null) return blockedText('noBelters');
      return c.pilotDaysLeft === null && state.credits + 1e-9 < CROSSING.pilot.fee ? blockedText('noPilot') : null;
  }
}

/** One readout row for the Hazard scene. */
export interface CrossOption {
  /** Method id. */
  method: CrossMethod;
  /** Refusal message (show dimmed), or null if it can be chosen. */
  blocker: string | null;
  /** Incident chance (never show it; use `risk`), null where not offered. */
  chance: number | null;
  /** Risk word id, null when blocked. */
  risk: RiskId | null;
  /** Tug price (tug only). */
  price?: number;
  /** Pilot wait days (pilot only, where offered). */
  waitDays?: number;
}

/** The four options with availability and risk, for the pending crossing ([] if none). */
export function crossingOptions(state: GameState): CrossOption[] {
  const c = state.crossing;
  if (!c) return [];
  const w = WAYPOINTS[c.waypoint]!;
  return CROSS_METHODS.map((method) => {
    const chance = crossChance(state, method);
    const blocker = crossBlocker(state, method);
    const opt: CrossOption = { method, blocker, chance, risk: blocker === null && chance !== null ? riskWord(chance) : null };
    if (method === 'tug') opt.price = tugPrice(state, w);
    if (method === 'pilot' && w.hazard?.pilotWait != null) opt.waitDays = w.hazard.pilotWait;
    return opt;
  });
}

/**
 * Resolve the pending crossing with `method` (mutates; assumes crossBlocker is null and, for the pilot, the wait is
 * over). Logs `crossing` (method), `hazard` (outcome), then `hazard` `pump-strain` (shields, 15%). Clears `crossing`.
 */
export function finishCrossing(s: GameState, method: CrossMethod, rng: Rng, out: LogEntry[]): CrossingOutcome {
  const c = s.crossing!;
  const w = WAYPOINTS[c.waypoint]!;
  const chance = crossChance(s, method)!;
  const densityBonus = c.density >= HAZARD.densitySeverityFrom ? HAZARD.densitySeverity : 0;
  const narrate = (key: string, id: string, fallback: string, vars = {}): void =>
    pushLog(s, out, 'crossing', resolveText(rng, 'ui', key, vars, fallback), id);
  let outcome: CrossingOutcome;
  switch (method) {
    case 'thread':
      narrate('hazard.thread', 'thread', 'You thread the gap.');
      outcome = isFlareBelt(w) ? resolveCrossing(s, c.waypoint, rng, out) : rollCrossing(s, chance, densityBonus, rng, out);
      break;
    case 'shields':
      narrate('hazard.shields', 'shields', 'Shields up. You push through.');
      outcome = rollCrossing(s, chance, densityBonus + CROSSING.shields.severity, rng, out);
      if (rng.chance(CROSSING.shields.pumpStrain) && !s.broken.pump) {
        s.broken.pump = true;
        pushLog(s, out, 'hazard', resolveText(rng, 'ui', 'hazard.pumpStrain', { item: PART_NAMES.pump }, 'The coolant pump gave out under the strain.'), 'pump-strain');
      }
      break;
    case 'tug': {
      const price = tugPrice(s, w);
      s.credits = Math.max(0, Math.round((s.credits - price) * 100) / 100);
      narrate('hazard.tug', 'tug', 'The tug hauls you through for {n} cr.', { n: price });
      outcome = rollCrossing(s, 0, 0, rng, out);
      break;
    }
    case 'pilot':
      narrate('hazard.pilotArrives', 'pilot-arrives', 'The Belter pilot takes the helm.');
      outcome = rollCrossing(s, chance, CROSSING.pilot.severity, rng, out);
      break;
  }
  s.crossing = null;
  return outcome;
}
