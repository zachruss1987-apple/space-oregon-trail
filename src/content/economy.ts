/** Road-station economy numbers (economy.md): buy-back and NPC trade offers. Markups live in waypoints.ts. */
import type { SupplyKey } from './items';

/** Sell price per pack = min(localFraction × local price, baseFraction × base price), floored to the cent. */
export const SELL = { localFraction: 0.5, baseFraction: 0.9 } as const;

/** What a trade can ask for: a supply or credits. */
export type TradeGood = SupplyKey | 'credits';

/** Base unit values in cents (drive 40 cr, ration 0.30, suit 10, charge 0.10, spare 10, credit 1). */
export const TRADE_UNIT_CENTS: Readonly<Record<TradeGood, number>> = {
  drives: 4000, rations: 30, suits: 1000, charges: 10, plates: 1000, pumps: 1000, gyros: 1000, credits: 100,
};

/** NPC offer generation (economy.md "NPC trade offers"). */
export const TRADE = {
  /** d100 ≤ this → 3 offers, else 2. */
  threeOffersMax: 50,
  many: 3,
  few: 2,
  /** Failed attempts before an offer slot is dropped. */
  attempts: 5,
  /** Get-item weights (drives 0 where the station sells none). */
  getWeights: [
    { item: 'drives' as SupplyKey, weight: 15 },
    { item: 'rations' as SupplyKey, weight: 30 },
    { item: 'suits' as SupplyKey, weight: 15 },
    { item: 'charges' as SupplyKey, weight: 10 },
    { item: 'plates' as SupplyKey, weight: 10 },
    { item: 'pumps' as SupplyKey, weight: 10 },
    { item: 'gyros' as SupplyKey, weight: 10 },
  ],
  /** Lot sizes in units: [min, max, step]. */
  lots: {
    drives: [1, 1, 1], rations: [30, 150, 10], suits: [1, 3, 1], charges: [20, 60, 20], plates: [1, 1, 1], pumps: [1, 1, 1], gyros: [1, 1, 1],
  } as Readonly<Record<SupplyKey, readonly [number, number, number]>>,
  /** Fairness d100 bands (inclusive upper bound) and ask ratio in percent. */
  fairness: [
    { max: 15, id: 'swindle', ratio: 160 },
    { max: 50, id: 'steep', ratio: 125 },
    { max: 85, id: 'fair', ratio: 100 },
    { max: 100, id: 'generous', ratio: 75 },
  ],
  /** Credit asks never go below this ratio (a trader is never cheaper than the cheapest store). */
  creditMinRatio: 100,
  /** Asks of these goods round up to a multiple of 5. */
  roundToFive: ['rations', 'charges'] as readonly TradeGood[],
  /** Drives the player must keep (trades and sales never take the last drive). */
  keepDrives: 1,
} as const;

/** Fairness ids. */
export type FairnessId = (typeof TRADE.fairness)[number]['id'];
