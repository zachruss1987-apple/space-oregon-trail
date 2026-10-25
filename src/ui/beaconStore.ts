/** Memorial beacon persistence (beacons.md): localStorage `proxima.beacons`, parsed and capped by the sim helpers. */
import { appendBeacon, BEACONS, parseBeacons, type BeaconRecord } from '@/sim';

/** Stored player beacons (defensive: blocked storage or bad JSON -> []). */
export function loadBeacons(): BeaconRecord[] {
  try {
    const raw = window.localStorage.getItem(BEACONS.key);
    return raw ? parseBeacons(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
}

/** Append one beacon (keeps the last 200). Storage blocked or full: silently skipped. */
export function saveBeacon(b: BeaconRecord): void {
  try {
    window.localStorage.setItem(BEACONS.key, JSON.stringify(appendBeacon(loadBeacons(), b)));
  } catch {
    // The beacon is lost to the void, which is thematically fine.
  }
}
