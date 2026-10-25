/** Pure view helpers for StationScene: Outfitters rows and trade rows (economy.md "Enter station flow"). */
import { ITEM_ORDER, ITEMS, type SupplyKey } from '@/content';
import {
  localPrice, maxBuyable, maxSellable, offerVars, personaName, roadBuyBlocker, sellBlocker, sellPrice,
  type GameState, type TradeOffer,
} from '@/sim';
import { t } from '@/ui/copy';
import type { MenuItem } from '@/ui/Menu';
import { col, fmt, money } from '@/ui/theme';

/** Column widths matching `station.outfitters.header`. */
const COLS = [14, 8, 8, 8, 6] as const;

/** The `station.outfitters.header` labels laid out on the row columns (numbers right-aligned). */
export function outfitterHeader(): string {
  const labels = t('station.outfitters.header').trim().split(/\s{2,}/);
  return labels.map((c, i) => col(c, COLS[i] ?? 6, i > 0)).join(' ');
}

/** One Outfitters row per item: name, buy price, buy-back price, held, room left ("—" where not traded / no cap). */
export function outfitterRows(s: GameState, wp: number): MenuItem[] {
  const none = t('station.outfitters.none');
  return ITEM_ORDER.map((id) => {
    const def = ITEMS[id];
    const buy = localPrice(id, wp);
    const sell = sellPrice(id, wp);
    const held = s.supplies[id];
    const room = def.cap === null ? none : fmt(Math.max(0, def.cap - held));
    const cells = [def.name, buy === null ? none : money(buy), sell === null ? none : money(sell), fmt(held), room];
    return { label: cells.map((c, i) => col(c, COLS[i]!, i > 0)).join(' ') };
  });
}

/** Why the Buy button is dimmed for an item here (null = enabled). */
export function buyReason(s: GameState, id: SupplyKey, wp: number): string | null {
  if (localPrice(id, wp) === null) return t('station.outfitters.noBuy');
  return maxBuyable(s, id) > 0 ? null : (roadBuyBlocker(s, id, 1) ?? t('station.outfitters.noBuy'));
}

/** Why the Sell button is dimmed for an item here (null = enabled). */
export function sellReason(s: GameState, id: SupplyKey, wp: number): string | null {
  if (sellPrice(id, wp) === null) return t('station.outfitters.noSell');
  return maxSellable(s, id) > 0 ? null : (sellBlocker(s, id, 1) ?? t('station.outfitters.noSell'));
}

/** Trade offer rows: persona name, "{give} for {get}", taken offers dimmed "(done)". */
export function tradeRows(offers: readonly TradeOffer[]): MenuItem[] {
  return offers.map((o) => {
    const v = offerVars(o);
    const label = `${personaName(o.persona)}: ${t('station.trade.line', { give: v.give, get: v.get })}`;
    return o.taken ? { label: `${label} ${t('station.trade.done')}`, disabled: t('station.trade.already') } : { label };
  });
}

/** "You give: …  You get: …" for an offer. */
export function tradeTerms(o: TradeOffer): string {
  const v = offerVars(o);
  return t('station.trade.terms', { give: v.give, get: v.get });
}
