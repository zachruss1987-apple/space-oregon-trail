/** Store: per-item station prices (economy.md), buying with limits and credits, buy-back prices, leaving Independence. */
import {
  ITEMS, MIN_DRIVES_TO_DEPART, RATIONS_WARNING_BELOW, SELL, WAYPOINTS, type SupplyKey,
} from '@/content';
import type { Rng } from './rng';
import { resolveText } from './text';
import type { GameState, LogEntry, StepResult } from './types';
import { cloneState, pushLog, roundHalfUp } from './util';

/** Round to whole cents, half up, to avoid float drift (0.30 cr rations, 1.5 markups). */
export function cents(x: number): number {
  return roundHalfUp(x * 100) / 100;
}

/** Round down to whole cents (buy-back prices). */
export function centsDown(x: number): number {
  return Math.floor(x * 100 + 1e-6) / 100;
}

/** Price per pack at a waypoint, or null if that store does not sell the item (or there is no store). */
export function localPrice(item: SupplyKey, waypointIndex: number): number | null {
  const m = WAYPOINTS[waypointIndex]?.markup?.[item];
  return m === undefined ? null : cents(ITEMS[item].basePrice * m);
}

/** Price per pack at a waypoint: base × markup. Throws where the item is not sold. */
export function priceAt(item: SupplyKey, waypointIndex = 0): number {
  const p = localPrice(item, waypointIndex);
  if (p === null) throw new Error(`${item} is not sold at waypoint ${waypointIndex}`);
  return p;
}

/** Cost of `packs` packs at a waypoint. */
export function costOf(item: SupplyKey, packs: number, waypointIndex = 0): number {
  return cents(priceAt(item, waypointIndex) * packs);
}

/** Buy-back price per pack: min(50% local, 90% base), floored to the cent. Null at Independence or if not sold. */
export function sellPrice(item: SupplyKey, waypointIndex: number): number | null {
  if (waypointIndex === 0) return null;
  const local = localPrice(item, waypointIndex);
  if (local === null) return null;
  return centsDown(Math.min(local * SELL.localFraction, ITEMS[item].basePrice * SELL.baseFraction));
}

/** Index of the store the player is in: 0 in the Independence store, a road station while parked there, else null. */
export function storeIndex(state: GameState): number | null {
  if (state.status === 'store') return 0;
  if (state.status !== 'traveling' || state.arrivedAt === null || state.arrivedAt === 0) return null;
  return WAYPOINTS[state.arrivedAt]?.markup ? state.arrivedAt : null;
}

/** Packs currently held (units / pack size, floored). */
export function packsHeld(state: GameState, item: SupplyKey): number {
  return Math.floor(state.supplies[item] / ITEMS[item].packSize);
}

/** Most packs the player may still buy here: min(limit room, cap room, affordable); 0 if not sold. */
export function maxBuyable(state: GameState, item: SupplyKey, waypointIndex = storeIndex(state) ?? 0): number {
  const def = ITEMS[item];
  const price = localPrice(item, waypointIndex);
  if (price === null) return 0;
  const limitRoom = def.buyLimit - packsHeld(state, item);
  const capRoom = def.cap === null ? Infinity : Math.floor((def.cap - state.supplies[item]) / def.packSize);
  const affordable = Math.floor(cents(state.credits / price) + 1e-9);
  return Math.max(0, Math.min(limitRoom, capRoom, affordable));
}

/** Why a purchase is refused here, or null if allowed (Independence store or a road station while parked). */
export function buyBlocker(state: GameState, item: SupplyKey, packs: number): string | null {
  const at = storeIndex(state);
  if (at === null) return 'The store is closed.';
  if (!(item in ITEMS)) return 'Unknown item.';
  if (localPrice(item, at) === null) return "They don't sell that here.";
  if (!Number.isInteger(packs) || packs < 1) return 'Quantity must be a whole number of at least 1.';
  const def = ITEMS[item];
  if (packsHeld(state, item) + packs > def.buyLimit) return `You can carry at most ${def.buyLimit}.`;
  if (def.cap !== null && state.supplies[item] + packs * def.packSize > def.cap) return `You can carry at most ${def.cap}.`;
  if (costOf(item, packs, at) > state.credits + 1e-9) return 'You cannot afford that.';
  return null;
}

/** Buy packs at the current store. Returns error and the unchanged state on refusal; credits never go negative. */
export function buy(state: GameState, item: SupplyKey, packs: number): StepResult {
  const error = buyBlocker(state, item, packs);
  if (error) return { state, entries: [], error };
  const next = cloneState(state);
  next.credits = Math.max(0, cents(next.credits - costOf(item, packs, storeIndex(state)!)));
  next.supplies[item] += packs * ITEMS[item].packSize;
  return { state: next, entries: [] };
}

/** Mattie's warnings for the current basket (resources.md). */
export function storeWarnings(state: GameState): string[] {
  const out: string[] = [];
  const s = state.supplies;
  if (s.drives === 0) out.push('noDrives');
  if (s.rations < RATIONS_WARNING_BELOW) out.push('lowRations');
  if (s.suits < state.crew.filter((c) => c.alive).length) out.push('lowSuits');
  if (state.credits <= 0) out.push('noCredits');
  return out;
}

/** Leave Independence: needs ≥ 1 drive; status → traveling. */
export function depart(state: GameState, rng: Rng): StepResult {
  if (state.status !== 'store') return { state, entries: [], error: 'Already under way.' };
  if (state.supplies.drives < MIN_DRIVES_TO_DEPART) return { state, entries: [], error: 'You will not get far.' };
  const next = cloneState(state);
  const entries: LogEntry[] = [];
  next.status = 'traveling';
  pushLog(next, entries, 'depart', resolveText(rng, 'ui', 'log.launch', {}, 'You cast off from Independence Station.'), 'independence-station');
  return { state: next, entries };
}
