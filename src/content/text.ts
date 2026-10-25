/** Writer-owned text tables (src/content/text/*.json), re-exported with loose types. Do not edit the JSON here. */
import bulletinsJson from './text/bulletins.json';
import deathsJson from './text/deaths.json';
import eventsJson from './text/events.json';
import uiJson from './text/ui.json';

/** Event/flavor text variants by key. */
export const EVENT_TEXT = eventsJson as unknown as Readonly<Record<string, unknown>>;
/** Death message variants by cause. */
export const DEATH_TEXT = deathsJson as unknown as Readonly<Record<string, unknown>>;
/** Waypoint bulletins by waypoint id. */
export const BULLETIN_TEXT = bulletinsJson as unknown as Readonly<Record<string, unknown>>;
/** UI copy. */
export const UI_TEXT = uiJson as unknown as Readonly<Record<string, unknown>>;
