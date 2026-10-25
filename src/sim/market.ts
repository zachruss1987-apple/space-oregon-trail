/** Road-station Outfitters intents: buy and sell while parked (economy.md "Buying on the road", "Buy-back"). */
import { ITEMS, TRADE, type SupplyKey, type TradeGood } from '@/content';
import { buy, buyBlocker, cents, costOf, packsHeld, sellPrice, storeIndex } from './store';
import { textLine } from './text';
import type { GameState, LogEntry, StepResult } from './types';
import { cloneState, pushLog } from './util';

const NOUNS: Readonly<Record<TradeGood, readonly [string, string]>> = {
  drives: ['ion drive', 'ion drives'],
  rations: ['ration', 'rations'],
  suits: ['EVA suit', 'EVA suits'],
  charges: ['drone charge', 'drone charges'],
  plates: ['hull plate', 'hull plates'],
  pumps: ['coolant pump', 'coolant pumps'],
  gyros: ['nav gyro', 'nav gyros'],
  credits: ['cr', 'cr'],
};

/** Credits for display: whole numbers bare, otherwise two decimals ("40", "2.50"). */
export function formatCr(x: number): string {
  const c = cents(x);
  return Number.isInteger(c) ? String(c) : c.toFixed(2);
}

/** Full phrase with count: "35 rations", "1 coolant pump", "40 cr". */
export function itemPhrase(item: TradeGood, qty: number): string {
  if (item === 'credits') return `${formatCr(qty)} cr`;
  const [one, many] = NOUNS[item];
  return `${qty} ${qty === 1 ? one : many}`;
}

/** Is the player parked at a road station (not Independence)? */
export function atRoadStation(state: GameState): boolean {
  const at = storeIndex(state);
  return at !== null && at > 0;
}

/** Road buy: same limits as Independence. */
export function roadBuyBlocker(state: GameState, item: SupplyKey, packs: number): string | null {
  if (!atRoadStation(state)) return 'The store is closed.';
  return buyBlocker(state, item, packs);
}

/** Most packs that may be sold here now (keeps the last drive); 0 if the store does not buy it. */
export function maxSellable(state: GameState, item: SupplyKey): number {
  const at = storeIndex(state);
  if (at === null || sellPrice(item, at) === null) return 0;
  const held = packsHeld(state, item);
  return item === 'drives' ? Math.max(0, held - TRADE.keepDrives) : held;
}

/** Why a sale is refused, or null. */
export function sellBlocker(state: GameState, item: SupplyKey, packs: number): string | null {
  const at = storeIndex(state);
  if (at === 0) return 'Mattie does not buy back.';
  if (at === null) return 'The store is closed.';
  if (!(item in ITEMS)) return 'Unknown item.';
  if (sellPrice(item, at) === null) return textLine('ui', 'station.outfitters.noSell', "They don't buy that here.");
  if (!Number.isInteger(packs) || packs < 1) return 'Quantity must be a whole number of at least 1.';
  if (packs > packsHeld(state, item)) return "You don't have that many.";
  if (item === 'drives' && state.supplies.drives - packs < TRADE.keepDrives) {
    return textLine('ui', 'station.leave.lastDrive', 'You need a drive to leave.');
  }
  return null;
}

/** Intent `buy` at a road station (0 days). Logs kind `store`, id = item. */
export function roadBuy(state: GameState, item: SupplyKey, packs: number): StepResult {
  const error = roadBuyBlocker(state, item, packs);
  if (error) return { state, entries: [], error };
  const cost = costOf(item, packs, storeIndex(state)!);
  const r = buy(state, item, packs);
  const entries: LogEntry[] = [];
  pushLog(r.state, entries, 'store', textLine('ui', 'station.log.bought', 'Bought {item} for {cr} cr.', { item: itemPhrase(item, packs * ITEMS[item].packSize), cr: formatCr(cost) }), item);
  return { state: r.state, entries };
}

/** Intent `sell` at a road station (0 days). Logs kind `store`, id = item. */
export function sell(state: GameState, item: SupplyKey, packs: number): StepResult {
  const error = sellBlocker(state, item, packs);
  if (error) return { state, entries: [], error };
  const s = cloneState(state);
  const gain = cents(sellPrice(item, storeIndex(state)!)! * packs);
  s.credits = cents(s.credits + gain);
  s.supplies[item] -= packs * ITEMS[item].packSize;
  const entries: LogEntry[] = [];
  pushLog(s, entries, 'store', textLine('ui', 'station.log.sold', 'Sold {item} for {cr} cr.', { item: itemPhrase(item, packs * ITEMS[item].packSize), cr: formatCr(gain) }), item);
  return { state: s, entries };
}
