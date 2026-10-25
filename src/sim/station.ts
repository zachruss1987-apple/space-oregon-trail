/** Station visit helpers for the Station scene (economy.md "Talk", "Enter station flow"). Pure; UI passes the text Rng. */
import { STATION_TEXT, WAYPOINTS } from '@/content';
import type { Rng } from './rng';
import { fill, lookupVariants, resolveText } from './text';
import type { GameState } from './types';

/** Talk lines for a station id (stations.json `talk`), [] if none. */
export function stationTalk(stationId: string): string[] {
  const entry = STATION_TEXT[stationId];
  const talk = entry && typeof entry === 'object' ? (entry as Record<string, unknown>)['talk'] : undefined;
  return Array.isArray(talk) ? talk.filter((t): t is string => typeof t === 'string') : [];
}

/** A per-visit shuffle of a station's talk lines (Fisher-Yates on the text Rng); show in order, reshuffle when exhausted. */
export function shuffledTalk(stationId: string, rng: Rng): string[] {
  const lines = stationTalk(stationId);
  for (let i = lines.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [lines[i], lines[j]] = [lines[j]!, lines[i]!];
  }
  return lines;
}

/** Keeper name for a station (stations.json `keeper`), or null if the writer has not named one. */
export function stationKeeper(stationId: string): string | null {
  return lookupVariants('stations', `${stationId}.keeper`)?.[0] ?? null;
}

/** Keeper greeting with {captain} filled (fallback "Welcome to {name}, Captain {captain}."). */
export function stationGreeting(rng: Rng, state: GameState, waypointIndex: number): string {
  const w = WAYPOINTS[waypointIndex]!;
  const captain = state.crew[0]?.name ?? '';
  return resolveText(rng, 'stations', `${w.id}.greeting`, { captain, name: w.name }, fill('Welcome to {name}, Captain {captain}.', { name: w.name, captain }));
}

/** True while the Station scene is available (parked at a road station with a visit). */
export function stationOpen(state: GameState): boolean {
  return state.status === 'traveling' && state.station !== null && state.station.waypoint === state.arrivedAt;
}
