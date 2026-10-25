/** The Lane: 17 waypoints (index 0 = start), 16 segments, 2,040 Mk. Source: docs/design/trail.md. */

/** Waypoint kinds. `start` behaves as a station (store, rest bonus). */
export type WaypointType = 'start' | 'station' | 'hazard' | 'landmark' | 'gate' | 'end';

/** Hazard crossing parameters (trail.md "Hazard parameters"). */
export interface HazardParams {
  /** Density 1–5; ≥ 4 adds +5 severity. */
  density: number;
  /** Baseline incident chance, percent. */
  incident: number;
  /** Tug price in credits (M2). */
  tugPrice: number;
  /** Pilot wait in days (M2); null where not offered. */
  pilotWait: number | null;
}

/** One waypoint on the Lane. */
export interface Waypoint {
  /** 0..16; segment n is the leg ending at waypoint n. */
  index: number;
  /** kebab-case of `name`; key into bulletins.json. */
  id: string;
  /** Display name. */
  name: string;
  /** Parenthetical from the design table, if any. */
  subtitle?: string;
  /** Waypoint kind. */
  type: WaypointType;
  /** Mk from the previous waypoint (length of segment `index`). */
  mk: number;
  /** Cumulative Mk from Independence Station. */
  cumulative: number;
  /** Crossing parameters (hazards only). */
  hazard?: HazardParams;
  /** Store price multiplier (stations only). Placeholder until economy.md (M2); Independence = 1. */
  markup?: number;
  /** True for the Oort Beacon branch stop (M2). */
  optional?: boolean;
}

type Row = Omit<Waypoint, 'index' | 'id' | 'cumulative'>;

const rows: Row[] = [
  { name: 'Independence Station', subtitle: 'Earth–Luna L1', type: 'start', mk: 0, markup: 1 },
  { name: 'Lunar Debris Ring', type: 'hazard', mk: 102, hazard: { density: 2, incident: 15, tugPrice: 25, pilotWait: 2 } },
  { name: 'Lagrange Shoals', type: 'hazard', mk: 83, hazard: { density: 2, incident: 15, tugPrice: 35, pilotWait: 2 } },
  { name: 'Mars Relay', type: 'station', mk: 119, markup: 1.25 },
  { name: 'Ceres Approach Spire', type: 'landmark', mk: 250 },
  { name: 'Ceres Depot', type: 'station', mk: 86, markup: 1.5 },
  { name: "Jupiter's Eye", subtitle: 'Great Red Spot flyby', type: 'landmark', mk: 190 },
  { name: 'The Belt Crossing', type: 'hazard', mk: 102, hazard: { density: 4, incident: 35, tugPrice: 80, pilotWait: 4 } },
  { name: 'Europa Outpost', type: 'station', mk: 57, markup: 1.75 },
  { name: 'Saturn Ring Plane', type: 'hazard', mk: 162, hazard: { density: 3, incident: 25, tugPrice: 60, pilotWait: 3 } },
  { name: 'Titan Refinery', type: 'station', mk: 57, markup: 2 },
  { name: 'Kuiper Gate', type: 'gate', mk: 182 },
  { name: 'Oort Beacon', subtitle: 'Proxima outer shell', type: 'station', mk: 114, markup: 2.25, optional: true },
  { name: 'Proxima Heliopause Shock', type: 'hazard', mk: 160, hazard: { density: 4, incident: 35, tugPrice: 90, pilotWait: 4 } },
  { name: 'Lane Terminus Station', type: 'station', mk: 55, markup: 2.5 },
  { name: 'The Flare Belt', type: 'hazard', mk: 120, hazard: { density: 5, incident: 45, tugPrice: 120, pilotWait: null } },
  { name: 'New Willamette', subtitle: 'Proxima b', type: 'end', mk: 201 },
];

/** kebab-case id from a display name ("Jupiter's Eye" → "jupiters-eye"). */
export function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

let running = 0;
/** All waypoints, index 0..16. */
export const WAYPOINTS: readonly Waypoint[] = rows.map((r, index) => {
  running += r.mk;
  return { ...r, index, id: toId(r.name), cumulative: running };
});

/** Index of the final waypoint (New Willamette). */
export const FINAL_WAYPOINT = WAYPOINTS.length - 1;
/** Total Lane length in Mk. */
export const TOTAL_MK = WAYPOINTS[FINAL_WAYPOINT]!.cumulative;

/** True if resting here earns the station bonus. */
export function isStation(w: Waypoint): boolean {
  return w.type === 'station' || w.type === 'start';
}
