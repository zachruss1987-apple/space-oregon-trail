/** When the `danger` sting plays (audio.md Songs: "Event alarms, Hazard arrival"). Pure: content tables only. */
import { EVENT_LIST, WAYPOINTS } from '@/content';
import type { LogEntry } from '@/sim';

/** Event ids in the loss category (pirates, failures, fires, drift...). */
export const LOSS_EVENT_IDS: ReadonlySet<string> = new Set(EVENT_LIST.filter((e) => e.category === 'loss').map((e) => e.id));

/** A day's entries call for the danger sting: a loss event, crossing damage (not a clean crossing), or a death. */
export function dangerSting(entries: readonly Pick<LogEntry, 'kind' | 'id'>[]): boolean {
  return entries.some((e) =>
    e.kind === 'death'
    || (e.kind === 'hazard' && e.id !== 'clear')
    || (e.kind === 'event' && e.id !== undefined && LOSS_EVENT_IDS.has(e.id)));
}

/** Arriving at waypoint `index` (a hazard crossing) calls for the sting. */
export function hazardArrival(index: number | null): boolean {
  return index !== null && WAYPOINTS[index]?.type === 'hazard';
}
