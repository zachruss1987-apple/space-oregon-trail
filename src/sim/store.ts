/** Store: prices, buying with limits and credits, leaving Independence (resources.md). */
import {
  ITEMS, MIN_DRIVES_TO_DEPART, RATIONS_WARNING_BELOW, SELL_FRACTION, WAYPOINTS, type SupplyKey,
} from '@/content';
import type { Rng } from './rng';
import { resolveText } from './text';
import type { GameState, LogEntry, StepResult } from './types';
import { cloneState, pushLog } from './util';

/** Round to whole cents to avoid float drift (0.30 cr rations). */
export function cents(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Price per pack at a waypoint index: base × markup. Throws for non-stations. */
export function priceAt(item: SupplyKey, waypointIndex = 0): number {
  const markup = WAYPOINTS[waypointIndex]?.markup;
  if (markup === undefined) throw new Error(`No store at waypoint ${waypointIndex}`);
  return cents(ITEMS[item].basePrice * markup);
}

/** Cost of `packs` packs at a waypoint. */
export function costOf(item: SupplyKey, packs: number, waypointIndex = 0): number {
  return cents(priceAt(item, waypointIndex) * packs);
}

/** Packs currently held (units / pack size, floored). */
export function packsHeld(state: GameState, item: SupplyKey): number {
  return Math.floor(state.supplies[item] / ITEMS[item].packSize);
}

/** Most packs the player may still buy: min(limit room, cap room, affordable). */
export function maxBuyable(state: GameState, item: SupplyKey, waypointIndex = 0): number {
  const def = ITEMS[item];
  const limitRoom = def.buyLimit - packsHeld(state, item);
  const capRoom = def.cap === null ? Infinity : Math.floor((def.cap - state.supplies[item]) / def.packSize);
  const price = priceAt(item, waypointIndex);
  const affordable = Math.floor(cents(state.credits / price) + 1e-9);
  return Math.max(0, Math.min(limitRoom, capRoom, affordable));
}

/** Why a purchase is refused, or null if allowed. M1: only in the Independence store. */
export function buyBlocker(state: GameState, item: SupplyKey, packs: number): string | null {
  if (state.status !== 'store') return 'The store is closed.';
  if (!Number.isInteger(packs) || packs < 1) return 'Quantity must be a whole number of at least 1.';
  if (!(item in ITEMS)) return 'Unknown item.';
  const def = ITEMS[item];
  if (packsHeld(state, item) + packs > def.buyLimit) return `You can carry at most ${def.buyLimit}.`;
  if (def.cap !== null && state.supplies[item] + packs * def.packSize > def.cap) return `You can carry at most ${def.cap}.`;
  if (costOf(item, packs) > state.credits + 1e-9) return 'You cannot afford that.';
  return null;
}

/** Buy packs at Independence Station. Returns error and the unchanged state on refusal. */
export function buy(state: GameState, item: SupplyKey, packs: number): StepResult {
  const error = buyBlocker(state, item, packs);
  if (error) return { state, entries: [], error };
  const next = cloneState(state);
  next.credits = cents(next.credits - costOf(item, packs));
  next.supplies[item] += packs * ITEMS[item].packSize;
  return { state: next, entries: [] };
}

/** Sell price per unit at a waypoint (M2). Independence does not buy back. */
export function sellPrice(item: SupplyKey, waypointIndex: number): number | null {
  if (waypointIndex === 0) return null;
  return cents((priceAt(item, waypointIndex) * SELL_FRACTION) / ITEMS[item].packSize);
}

/** Mattie's warnings for the current basket (resources.md). */
export function storeWarnings(state: GameState): string[] {
  const out: string[] = [];
  const s = state.supplies;
  if (s.drives === 0) out.push('noDrives');
  if (s.rations < RATIONS_WARNING_BELOW) out.push('lowRations');
  if (s.suits < state.crew.filter((c) => c.alive).length) out.push('fewSuits');
  if (state.credits <= 0) out.push('broke');
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
