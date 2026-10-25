/** Store items and supply keys. Source: docs/design/resources.md. */

/** Supply keys held in `GameState.supplies`. */
export type SupplyKey = 'drives' | 'rations' | 'suits' | 'charges' | 'plates' | 'pumps' | 'gyros';
/** Spare-part supply keys. */
export type SpareKey = 'plates' | 'pumps' | 'gyros';

/** A store item. Prices and limits are per pack ("sold as"). */
export interface Item {
  /** Supply key. */
  id: SupplyKey;
  /** Display name. */
  name: string;
  /** State unit name, singular. */
  unit: string;
  /** Units added to supplies per pack bought (charges: box of 20). */
  packSize: number;
  /** Base price per pack at Independence Station, credits. */
  basePrice: number;
  /** Max packs that may be held after buying at the start store. */
  buyLimit: number;
  /** Inventory cap in units, or null for none. */
  cap: number | null;
}

/** All store items by key. */
export const ITEMS: Readonly<Record<SupplyKey, Item>> = {
  drives: { id: 'drives', name: 'Ion drives', unit: 'drive', packSize: 1, basePrice: 40, buyLimit: 9, cap: 9 },
  rations: { id: 'rations', name: 'Rations', unit: 'ration-day', packSize: 1, basePrice: 0.3, buyLimit: 3000, cap: null },
  suits: { id: 'suits', name: 'EVA suits', unit: 'suit', packSize: 1, basePrice: 10, buyLimit: 99, cap: null },
  charges: { id: 'charges', name: 'Drone charges', unit: 'charge', packSize: 20, basePrice: 2, buyLimit: 99, cap: null },
  plates: { id: 'plates', name: 'Hull plates', unit: 'spare', packSize: 1, basePrice: 10, buyLimit: 3, cap: 3 },
  pumps: { id: 'pumps', name: 'Coolant pumps', unit: 'spare', packSize: 1, basePrice: 10, buyLimit: 3, cap: 3 },
  gyros: { id: 'gyros', name: 'Nav gyros', unit: 'spare', packSize: 1, basePrice: 10, buyLimit: 3, cap: 3 },
};

/** Store display order. */
export const ITEM_ORDER: readonly SupplyKey[] = ['drives', 'rations', 'suits', 'charges', 'plates', 'pumps', 'gyros'];
/** Spare-part keys in roster order. */
export const SPARE_KEYS: readonly SpareKey[] = ['plates', 'pumps', 'gyros'];
/** Supplies that cargo loss (pirates, hazards) may hit. */
export const LOSABLE_KEYS: readonly SupplyKey[] = ['rations', 'suits', 'charges', 'plates', 'pumps', 'gyros'];
/** Cap on each spare type in the hold, including finds. */
export const SPARE_CAP = 3;
/** Minimum drives to leave Independence. */
export const MIN_DRIVES_TO_DEPART = 1;
/** Mattie warns when rations bought are below this. */
export const RATIONS_WARNING_BELOW = 1000;
