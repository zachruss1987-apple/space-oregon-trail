/** The Titan Refinery route branch (hazards.md "Route branch"): via Oort Beacon (default) or direct. */
import { FINAL_WAYPOINT, ROUTE, WAYPOINTS, type RouteId, type Waypoint } from '@/content';
import type { Rng } from './rng';
import { resolveText, textLine } from './text';
import type { GameState, LogEntry, StepResult } from './types';
import { cloneState, pushLog } from './util';

/** Index of the waypoint after `index` on a route (direct skips Oort Beacon after the Kuiper Gate). */
export function nextWaypoint(index: number, route: RouteId): number {
  if (route === 'direct' && index === ROUTE.skipAfter) return ROUTE.skipped + 1;
  return Math.min(FINAL_WAYPOINT, index + 1);
}

/** True if a waypoint is skipped on this route. */
export function isSkipped(index: number, route: RouteId): boolean {
  return route === 'direct' && index === ROUTE.skipped;
}

/** Cumulative Mk to waypoint `index` on a route (direct: 114 Mk less from the Heliopause on). */
export function cumulativeAt(index: number, route: RouteId): number {
  const w = WAYPOINTS[index]!;
  return route === 'direct' && index > ROUTE.skipped ? w.cumulative - WAYPOINTS[ROUTE.skipped]!.mk : w.cumulative;
}

/** The active waypoint list for a route, with route-correct cumulative Mk (map data). */
export function routeWaypoints(route: RouteId): Waypoint[] {
  return WAYPOINTS.filter((w) => !isSkipped(w.index, route)).map((w) => ({ ...w, cumulative: cumulativeAt(w.index, route) }));
}

/** Total trail length on a route: 2,040 via Oort, 1,926 direct. */
export function totalMk(route: RouteId): number {
  return cumulativeAt(FINAL_WAYPOINT, route);
}

/** Why the route cannot be chosen now, or null (only while parked at Titan Refinery). */
export function routeBlocker(state: GameState): string | null {
  if (state.status !== 'traveling') return 'The journey is over.';
  if (state.arrivedAt === ROUTE.branchAt) return null;
  const pos = state.arrivedAt ?? state.segment;
  return pos > ROUTE.branchAt
    ? textLine('ui', 'route.behind', 'The branch is behind you.')
    : textLine('ui', 'route.notYet', 'You have not reached the fork yet.');
}

/** Intent `route` (0 days): set the route; log kind `route`, id = via. */
export function chooseRoute(state: GameState, via: RouteId, rng: Rng): StepResult {
  const error = routeBlocker(state);
  if (error) return { state, entries: [], error };
  const s = cloneState(state);
  s.route = via;
  const entries: LogEntry[] = [];
  const fallback = via === 'oort' ? 'You set course via Oort Beacon.' : 'You set course direct for the Heliopause.';
  pushLog(s, entries, 'route', resolveText(rng, 'ui', `route.chosen.${via}`, {}, fallback), via);
  return { state: s, entries };
}
