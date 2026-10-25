import type { SupplyKey } from './items';

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
  /** Belter pilot wait in days (hazards.md: Belt Crossing and Saturn Ring Plane only); null where not offered. */
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
  /** Per-item store markup (economy.md); a missing key = not sold here. Undefined = no store. */
  markup?: Markup;
  /** True for the Oort Beacon branch stop (M2). */
  optional?: boolean;
}

/** Per-item price multipliers at one store. */
export type Markup = Readonly<Partial<Record<SupplyKey, number>>>;

/** Build a markup from the economy.md column order: drives, rations, suits, charges, plates, pumps, gyros (null = not sold). */
function mk(...m: (number | null)[]): Markup {
  const keys: SupplyKey[] = ['drives', 'rations', 'suits', 'charges', 'plates', 'pumps', 'gyros'];
  const out: Partial<Record<SupplyKey, number>> = {};
  keys.forEach((k, i) => {
    const v = m[i];
    if (v !== null && v !== undefined) out[k] = v;
  });
  return out;
}

type Row = Omit<Waypoint, 'index' | 'id' | 'cumulative'>;

const rows: Row[] = [
  { name: 'Independence Station', subtitle: 'Earth–Luna L1', type: 'start', mk: 0, markup: mk(1, 1, 1, 1, 1, 1, 1) },
  { name: 'Lunar Debris Ring', type: 'hazard', mk: 102, hazard: { density: 2, incident: 15, tugPrice: 25, pilotWait: null } },
  { name: 'Lagrange Shoals', type: 'hazard', mk: 83, hazard: { density: 2, incident: 15, tugPrice: 35, pilotWait: null } },
  { name: 'Mars Relay', type: 'station', mk: 119, markup: mk(1.25, 1, 1.25, 1.25, 1.25, 1.25, 1.25) },
  { name: 'Ceres Approach Spire', type: 'landmark', mk: 250 },
  { name: 'Ceres Depot', type: 'station', mk: 86, markup: mk(1.5, 1.5, 1.5, 1, 1.25, 1.5, 1.5) },
  { name: "Jupiter's Eye", subtitle: 'Great Red Spot flyby', type: 'landmark', mk: 190 },
  { name: 'The Belt Crossing', type: 'hazard', mk: 102, hazard: { density: 4, incident: 35, tugPrice: 80, pilotWait: 4 } },
  { name: 'Europa Outpost', type: 'station', mk: 57, markup: mk(2, 1.5, 1.25, 1.75, 1.75, 1.75, 1.75) },
  { name: 'Saturn Ring Plane', type: 'hazard', mk: 162, hazard: { density: 3, incident: 25, tugPrice: 60, pilotWait: 3 } },
  { name: 'Titan Refinery', type: 'station', mk: 57, markup: mk(1.75, 2.5, 2, 2, 2, 1.25, 2) },
  { name: 'Kuiper Gate', type: 'gate', mk: 182 },
  { name: 'Oort Beacon', subtitle: 'Proxima outer shell', type: 'station', mk: 114, markup: mk(null, 2.5, 2.25, 2.25, 2.5, 2.5, 1.5), optional: true },
  { name: 'Proxima Heliopause Shock', type: 'hazard', mk: 160, hazard: { density: 4, incident: 35, tugPrice: 90, pilotWait: null } },
  { name: 'Lane Terminus Station', type: 'station', mk: 55, markup: mk(2.5, 2, 2.5, 2.5, 2.5, 2.5, 2.5) },
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

/** Route choice at Titan Refinery (hazards.md "Route branch"). */
export type RouteId = 'oort' | 'direct';
/** Route branch data: the branch station, the waypoint after which `direct` skips, the skipped stop. */
export const ROUTE = { branchAt: 10, skipAfter: 11, skipped: 12, heliopauseId: 'proxima-heliopause-shock', directIncidentBonus: 10 } as const;
