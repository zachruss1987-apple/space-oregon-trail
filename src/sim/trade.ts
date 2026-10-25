/** NPC barter offers at road stations (economy.md "NPC trade offers"): generation on arrival and accept-once trades. */
import { ITEMS, TRADE, TRADE_TEXT, TRADE_UNIT_CENTS, type SupplyKey, type TradeGood } from '@/content';
import { itemPhrase } from './market';
import type { Rng } from './rng';
import { localPrice } from './store';
import { resolveText, textLine } from './text';
import type { GameState, LogEntry, StepResult, TradeOffer } from './types';
import { cloneState, pushLog } from './util';

const SUPPLY_GIVES: readonly SupplyKey[] = ['rations', 'suits', 'charges', 'plates', 'pumps', 'gyros', 'drives'];

/** Persona ids from trades.json, in file order. */
export function personaIds(): string[] {
  const personas = TRADE_TEXT['personas'];
  return personas && typeof personas === 'object' ? Object.keys(personas) : [];
}

/** Persona display name ("Belter miner"), or the id. */
export function personaName(id: string): string {
  return textLine('trades', `personas.${id}.name`, id);
}

/** Units of `good` the player can hand over (credits: whole cr; drives: all but the last). */
export function tradable(state: GameState, good: TradeGood): number {
  if (good === 'credits') return Math.floor(state.credits + 1e-9);
  if (good === 'drives') return Math.max(0, state.supplies.drives - TRADE.keepDrives);
  return state.supplies[good];
}

/** Base value in cents of a lot (economy.md step 4). */
export function lotValueCents(good: TradeGood, qty: number): number {
  return TRADE_UNIT_CENTS[good] * qty;
}

/** Ask quantity for value `v` (cents) at fairness ratio `ratio` (percent): ceil, then up to a multiple of 5 for rations/charges. */
export function askQty(good: TradeGood, v: number, ratio: number): number {
  const r = good === 'credits' ? Math.max(ratio, TRADE.creditMinRatio) : ratio;
  const raw = Math.ceil((v * r) / (TRADE_UNIT_CENTS[good] * 100));
  return TRADE.roundToFive.includes(good) ? Math.ceil(raw / 5) * 5 : raw;
}

function atCap(state: GameState, item: SupplyKey): boolean {
  const cap = ITEMS[item].cap;
  return cap !== null && state.supplies[item] >= cap;
}

/** One offer slot: up to TRADE.attempts get draws; each tries give candidates until one is affordable. */
function draftOffer(state: GameState, waypoint: number, persona: string, rng: Rng): TradeOffer | null {
  for (let attempt = 0; attempt < TRADE.attempts; attempt++) {
    const weights = TRADE.getWeights.filter(
      (w) => !atCap(state, w.item) && !(w.item === 'drives' && localPrice('drives', waypoint) === null),
    );
    if (weights.length === 0) return null;
    const item = rng.weighted(weights);
    const [min, max, step] = TRADE.lots[item];
    const qty = min + step * rng.int(0, (max - min) / step);
    const v = lotValueCents(item, qty);
    const d100 = rng.int(1, 100);
    const band = TRADE.fairness.find((f) => d100 <= f.max) ?? TRADE.fairness[TRADE.fairness.length - 1]!;
    const candidates: TradeGood[] = [];
    if (state.credits >= 1) candidates.push('credits');
    for (const k of SUPPLY_GIVES) {
      if (k === item) continue;
      if (k === 'drives' ? state.supplies.drives >= 2 : state.supplies[k] > 0) candidates.push(k);
    }
    while (candidates.length > 0) {
      const good = candidates.splice(rng.int(0, candidates.length - 1), 1)[0]!;
      const ask = askQty(good, v, band.ratio);
      if (ask <= tradable(state, good)) {
        return { persona, give: { item: good, qty: ask }, get: { item, qty }, fairness: band.id, taken: false };
      }
    }
  }
  return null;
}

/** Generate 0–3 offers for a road-station visit (main Rng, arrival tick). Personas are drawn without replacement. */
export function generateOffers(state: GameState, waypoint: number, rng: Rng): TradeOffer[] {
  const count = rng.int(1, 100) <= TRADE.threeOffersMax ? TRADE.many : TRADE.few;
  const pool = personaIds();
  const offers: TradeOffer[] = [];
  for (let i = 0; i < count; i++) {
    const persona = pool.length > 0 ? pool.splice(rng.int(0, pool.length - 1), 1)[0]! : 'trader';
    const offer = draftOffer(state, waypoint, persona, rng);
    if (offer) offers.push(offer);
  }
  return offers;
}

/** Placeholder values for persona lines: {give}, {get}, {n}. */
export function offerVars(offer: TradeOffer): { give: string; get: string; n: number } {
  return { give: itemPhrase(offer.give.item, offer.give.qty), get: itemPhrase(offer.get.item, offer.get.qty), n: offer.get.qty };
}

/** A persona line for an offer (UI: pass the text Rng). `offer` falls back to `pitch` if the writer renames it. */
export function tradeLine(rng: Rng, offer: TradeOffer, kind: 'offer' | 'accept' | 'decline'): string {
  const vars = offerVars(offer);
  const key = `personas.${offer.persona}.${kind}`;
  const fallback: Record<typeof kind, string> = {
    offer: 'Got {get}. Want {give}.',
    accept: 'Deal.',
    decline: 'Suit yourself.',
  };
  if (kind === 'offer' && textLine('trades', key, '') === '') {
    return resolveText(rng, 'trades', `personas.${offer.persona}.pitch`, vars, fallback.offer);
  }
  return resolveText(rng, 'trades', key, vars, fallback[kind]);
}

/** Why offer `index` cannot be accepted now, or null. */
export function tradeBlocker(state: GameState, index: number): string | null {
  const visit = state.station;
  if (!visit || visit.waypoint !== state.arrivedAt) return textLine('ui', 'station.trade.nobody', 'Nobody here wants to trade.');
  const offer = visit.offers[index];
  if (!offer) return 'No such offer.';
  if (offer.taken) return textLine('ui', 'station.trade.already', 'That deal is done.');
  const { give, get } = offer;
  const held = give.item === 'credits' ? state.credits + 1e-9 : state.supplies[give.item];
  if (held < give.qty) return `You don't have ${itemPhrase(give.item, give.qty)} anymore.`;
  if (give.item === 'drives' && state.supplies.drives - give.qty < TRADE.keepDrives) {
    return textLine('ui', 'station.leave.lastDrive', 'You need a drive to leave.');
  }
  const cap = ITEMS[get.item].cap;
  if (cap !== null && state.supplies[get.item] + get.qty > cap) return `You can carry at most ${cap}.`;
  return null;
}

/** Intent `trade` (0 days): give, get, mark taken; log kind `trade`, id = persona, text from its accept lines. */
export function acceptTrade(state: GameState, index: number, rng: Rng): StepResult {
  const error = tradeBlocker(state, index);
  if (error) return { state, entries: [], error };
  const s = cloneState(state);
  const offer = s.station!.offers[index]!;
  if (offer.give.item === 'credits') s.credits = Math.round((s.credits - offer.give.qty) * 100) / 100;
  else s.supplies[offer.give.item] -= offer.give.qty;
  s.supplies[offer.get.item] += offer.get.qty;
  offer.taken = true;
  const entries: LogEntry[] = [];
  pushLog(s, entries, 'trade', tradeLine(rng, offer, 'accept'), offer.persona);
  return { state: s, entries };
}
