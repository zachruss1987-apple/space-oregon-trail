/**
 * Player-facing copy. Everything comes from src/content/text/ui.json via the sim's resolveText.
 * FALLBACK lists the keys the UI needs that ui.json does not have yet (writer follow-up); a ui.json
 * entry with the same dotted key always wins.
 */
import { BULLETIN_TEXT, UI_TEXT } from '@/content';
import { resolveText, type Rng } from '@/sim';
import { session } from '@/game/session';

export const FALLBACK: Readonly<Record<string, string>> = {
  'title.seed': 'Seed: {seed}',
  'title.comingSoon': 'That part of the trail opens in a later milestone.',
  'title.hint': 'Arrows or number keys to choose, Enter to confirm.',
  'common.ok': 'OK',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.back': 'Esc: back',
  'setup.captain': 'Captain',
  'setup.crew': 'Crew {n}',
  'setup.randomHint': 'Tab: {label}',
  'setup.credits': '{n} cr',
  'store.title': "MATTIE'S OUTFITTERS",
  'store.leave': 'Leave the store',
  'store.header': 'Item                         Price    Qty        Cost',
  'store.total': 'Total: {total} cr     Credits left: {left} cr',
  'store.qtyPrompt': 'How many? (max {n})',
  'store.perBox': 'box of {n}',
  'travel.auto': 'Hold Enter or press T to travel until something happens.',
  'travel.autoOn': 'Traveling... (T or any key to stop)',
  'travel.autoIndicator': 'TRAVELING… (any key to stop)',
  'travel.thrustOption': '{name} ({mk} Mk/day, health {health})',
  'travel.rationOption': '{name} ({n} days left at this setting)',
  'travel.restPrompt': 'Rest for how many days? (1-9)',
  'travel.repairOption': '{part} (spares: {n})',
  'travel.repairPrompt': 'Which part will you repair?',
  'travel.thrustPrompt': 'Set thrust:',
  'travel.rationsPrompt': 'Set rations:',
  'travel.scanConfirm': 'Spend 5 charges and a day?',
  'travel.cancel': 'Cancel',
  'status.units.mk': 'Mk',
  'status.nextValue': '{name} in {n} Mk',
  'status.traveledValue': '{n} Mk',
  'supplies.title': 'SUPPLIES',
  'supplies.crew': 'CREW',
  'supplies.offline': '({n} offline)',
  'supplies.days': '(~{n} days)',
  'supplies.broken': '[{part} BROKEN]',
  'supplies.away': 'away',
  'supplies.died': 'died ({cause})',
  'supplies.credits': 'Credits',
  'supplies.return': 'Enter or Esc to return.',
  'map.title': 'THE LANE',
  'map.col.waypoint': 'Waypoint',
  'map.col.type': 'Type',
  'map.type.station': 'station',
  'map.type.hazard': 'hazard',
  'map.type.landmark': 'landmark',
  'map.type.gate': 'gate',
  'map.type.end': 'colony',
  'map.passed': 'passed',
  'map.next': 'next: {n} Mk',
  'map.here': 'here',
  'waypoint.continue': 'Continue on the Lane',
  'waypoint.enter': 'Enter station',
  'waypoint.storeLater': 'The station store opens in a later milestone. Mattie sends her regards.',
  'waypoint.bulletin': 'Bulletin board:',
  'death.beaconSaved': 'Your message is on the beacon.',
  'arrival.returnTitle': 'Return to title',
  'score.title': 'SCORE',
  'score.labels.crew': 'Surviving crew',
  'score.labels.ship': 'The ship',
  'score.labels.drives': 'Ion drives',
  'score.labels.spares': 'Spare parts',
  'score.labels.suits': 'EVA suits',
  'score.labels.charges': 'Drone charges',
  'score.labels.rations': 'Rations',
  'score.labels.credits': 'Credits',
  'score.labels.flareBonus': 'Beat the flare season',
  'score.labels.noDeathsBonus': 'Nobody died',
  'score.labels.rodeTheWind': 'Rode the wind',
  'score.subtotal': 'Subtotal',
  'score.multiplier': 'Profession multiplier',
  'score.total': 'Total',
  'score.rating': 'Rating: {rating}',
  'station.outfitters.noneToSell': 'You have none to sell.',
};

/**
 * T-025 keys not yet in ui.json (writer follow-up: add them there, then delete this table). Kept apart from FALLBACK
 * because tests/unit/content/text.test.ts requires every FALLBACK key to exist in ui.json.
 */
export const PENDING: Readonly<Record<string, string>> = {
  'waypoint.cross': 'Approach the crossing',
  'waypoint.beacons': 'Memorial beacons',
  'hazard.densityLine': '{label}: {n} of {max} ({trend})  [{bar}]',
  'hazard.fundsLine': '{label}: {n} cr',
  'hazard.tugTerms': '{label} ({n} cr)',
  'hazard.pilotTerms': '{label} ({n} days, {fee} cr)',
  'hazard.pilotPending': '{label} (pilot due in {n} days)',
  'hazard.rest': 'Rest here a while',
  'hazard.other': 'Other actions (travel menu)',
  'station.creditsLine': 'Credits: {n} cr',
  'station.outfitters.title': 'OUTFITTERS',
  'station.outfitters.buy': 'Buy',
  'station.outfitters.sell': 'Sell',
  'station.outfitters.back': 'Back to the station',
  'station.outfitters.perBox': '(box of {n})',
  'station.trade.line': '{give} for {get}',
  'station.trade.terms': 'You give: {give}  You get: {get}',
  'route.directLabel': 'direct',
  'route.oortLabel': 'via Oort Beacon',
  'map.skipped': 'skipped',
  'map.branch': 'At Titan Refinery: {oortLabel} {oort} Mk / {directLabel} {direct} Mk',
};


/** Cosmetic rng for picking text variants; never the run rng, so UI copy cannot change outcomes. */
function uiRng(): Rng {
  return session.uiRng;
}

/** One line of UI copy by dotted key, with {placeholders} filled. */
export function t(key: string, vars: Readonly<Record<string, string | number>> = {}): string {
  return resolveText(uiRng(), 'ui', key, vars, FALLBACK[key] ?? PENDING[key]);
}

/** A string list from ui.json (menus, advice). */
export function list(key: string): string[] {
  const node = key.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), UI_TEXT);
  return Array.isArray(node) ? node.filter((x): x is string => typeof x === 'string') : [];
}

/** A waypoint's blurb and one random bulletin line. */
export function bulletin(waypointId: string): { blurb: string; line: string } {
  const entry = BULLETIN_TEXT[waypointId] as { blurb?: string; lines?: string[] } | undefined;
  const lines = entry?.lines ?? [];
  return { blurb: entry?.blurb ?? '', line: lines.length ? uiRng().pick(lines) : '' };
}
