/** The M1 auto-play reference policy (end of travel.md), for the playthrough test and balance harness. */
import { FINAL_WAYPOINT, ITEMS, PROFESSION_ORDER, WINDOW_ORDER, type ProfessionId, type SupplyKey, type WindowId } from '@/content';
import { applyAction } from './actions';
import { createGame } from './game';
import { brokenParts, sparesFor } from './repair';
import { createRng, type Rng } from './rng';
import { canScan } from './salvage';
import { computeScore } from './score';
import { buy, depart, maxBuyable } from './store';
import { daysOfRations } from './travel';
import type { DeathCause, GameState, Intent, Status } from './types';
import { averageHealth } from './util';

/** Policy thresholds. */
export const POLICY = { restBelowHealth: 50, lowRationDays: 10, maxDays: 1000 } as const;

/** The reference shopping list in packs (rations: the remainder, capped by the buy limit). */
export function policyKit(profession: ProfessionId): Partial<Record<SupplyKey, number>> {
  return { drives: 3, suits: profession === 'farmer' ? 5 : 10, plates: 1, pumps: 1, gyros: 1, charges: 5 };
}

/** Buy the reference kit, then rations with what is left. */
export function policyShop(state: GameState): GameState {
  let s = state;
  for (const [item, packs] of Object.entries(policyKit(s.profession)) as [SupplyKey, number][]) {
    const n = Math.min(packs, maxBuyable(s, item));
    if (n > 0) s = buy(s, item, n).state;
  }
  const rations = Math.min(maxBuyable(s, 'rations'), ITEMS.rations.buyLimit);
  if (rations > 0) s = buy(s, 'rations', rations).state;
  return s;
}

/** Next intent: repair if possible, set rations, rest when weak, scan when low, else continue. */
export function policyIntent(state: GameState): Intent {
  const fixable = brokenParts(state).find((p) => sparesFor(state, p) > 0);
  if (fixable) return { type: 'repair', part: fixable };
  const low = daysOfRations(state, 'half') < POLICY.lowRationDays;
  const want = low ? 'paste' : 'half';
  if (state.rations !== want) return { type: 'setRations', rations: want };
  if (state.thrust !== 'cruise') return { type: 'setThrust', thrust: 'cruise' };
  if (averageHealth(state) < POLICY.restBelowHealth) return { type: 'rest', days: 1 };
  if (low && canScan(state) && state.arrivedAt !== FINAL_WAYPOINT) return { type: 'scan' };
  return { type: 'continue' };
}

/** Summary of one auto-played run. */
export interface RunSummary {
  seed: number;
  profession: ProfessionId;
  window: WindowId;
  status: Status;
  days: number;
  deaths: number;
  causes: DeathCause[];
  score: number;
  final: GameState;
}

/** Auto-play one run. Profession/window are uniform random unless given. */
export function runPolicy(seed: number, opts: { profession?: ProfessionId; window?: WindowId } = {}): RunSummary {
  const rng: Rng = createRng(seed);
  const profession = opts.profession ?? rng.pick(PROFESSION_ORDER);
  const window = opts.window ?? rng.pick(WINDOW_ORDER);
  let s = policyShop(createGame({ profession, window }, rng));
  s = depart(s, rng).state;
  while (s.status === 'traveling' && s.day < POLICY.maxDays) {
    const r = applyAction(s, policyIntent(s), rng);
    if (r.error) throw new Error(`Policy intent refused on day ${s.day}: ${r.error}`);
    s = r.state;
  }
  return {
    seed, profession, window, status: s.status, days: s.day, deaths: s.deaths,
    causes: s.crew.filter((c) => !c.alive).map((c) => c.cause as DeathCause),
    score: s.status === 'arrived' ? computeScore(s).total : 0,
    final: s,
  };
}
