/** Writer-owned text tables (src/content/text/*.json), re-exported with loose types. Do not edit the JSON here. */
import bulletinsJson from './text/bulletins.json';
import deathsJson from './text/deaths.json';
import epitaphsJson from './text/epitaphs.json';
import eventsJson from './text/events.json';
import highscoresJson from './text/highscores.json';
import stationsJson from './text/stations.json';
import tradesJson from './text/trades.json';
import uiJson from './text/ui.json';

/** Event/flavor text variants by key. */
export const EVENT_TEXT = eventsJson as unknown as Readonly<Record<string, unknown>>;
/** Death message variants by cause. */
export const DEATH_TEXT = deathsJson as unknown as Readonly<Record<string, unknown>>;
/** Waypoint bulletins by waypoint id. */
export const BULLETIN_TEXT = bulletinsJson as unknown as Readonly<Record<string, unknown>>;
/** UI copy. */
export const UI_TEXT = uiJson as unknown as Readonly<Record<string, unknown>>;
/** Station keeper/greeting/talk lines by station waypoint id. */
export const STATION_TEXT = stationsJson as unknown as Readonly<Record<string, unknown>>;
/** NPC trade personas: `{ personas: { id: { name, offer[], accept[], decline[] } } }`. */
export const TRADE_TEXT = tradesJson as unknown as Readonly<Record<string, unknown>>;
/** Canned memorial beacons: `{ beacons: [{ segment, captain, name, text, date }] }`. */
export const EPITAPH_TEXT = epitaphsJson as unknown as Readonly<Record<string, unknown>>;
/** Seeded high scores: `{ defaults: [{ name, profession, score, days, date }] }`. */
export const HIGHSCORE_TEXT = highscoresJson as unknown as Readonly<Record<string, unknown>>;
