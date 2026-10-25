/** Pure view helpers for TravelScene: status cells, menu rows, sub-menu options. Reads sim helpers only. */
import { PART_NAMES, RATIONS, THRUST, WAYPOINTS, WEATHER, type RationId, type ThrustId } from '@/content';
import {
  brokenParts, daysOfRations, generalHealth, intentBlocker, remainingInSegment, sparesFor,
  type GameState, type Intent, type LogKind, type PartId,
} from '@/sim';
import { session } from '@/game/session';
import { list, t } from '@/ui/copy';
import type { MenuItem } from '@/ui/Menu';
import type { StatusCell } from '@/ui/StatusBar';
import { fmt, money } from '@/ui/theme';

/** Entries that end "travel until something happens". */
export const STOP_KINDS: ReadonlySet<LogKind> = new Set(['event', 'condition', 'death', 'arrival', 'hazard', 'gameover']);
/** Entries worth a modal on the Travel screen (hazards get the Waypoint scene's modal). */
export const MODAL_KINDS: ReadonlySet<LogKind> = new Set(['event', 'condition', 'death']);

export const THRUST_ORDER: readonly ThrustId[] = ['cruise', 'hard', 'overburn'];
export const RATION_ORDER: readonly RationId[] = ['full', 'half', 'paste'];

/** "May 12, 2184" from an ISO date (UTC; no wall clock). */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Status-panel rows per docs/design/ui.md. */
export function statusRows(s: GameState): StatusCell[][] {
  const L = (k: string): string => t(`status.labels.${k}`);
  const thrust = THRUST[s.thrust].name;
  const rations = RATIONS[s.rations].name;
  const weather = WEATHER[s.weather].name;
  const health = generalHealth(s);
  const next = WAYPOINTS[s.segment];
  return [
    [[L('date'), formatDate(s.date)], [L('weather'), t(`status.weather.${weather}`)], [L('health'), t(`status.health.${health}`)]],
    [[L('thrust'), t(`status.thrust.${thrust}`)], [L('rations'), t(`status.rations.${rations}`)], [L('credits'), money(s.credits)]],
    [
      [L('next'), next ? t('status.nextValue', { name: next.name, n: fmt(remainingInSegment(s)) }) : '', 48],
      [L('traveled'), t('status.traveledValue', { n: fmt(s.distanceTotal) })],
    ],
  ];
}

/** The eight canonical actions, with disabled reasons from the sim (Scan: 5 charges when auto-resolving, else 1). */
export function actionItems(s: GameState): MenuItem[] {
  const labels = list('travel.menu');
  const repairReason = brokenParts(s).length === 0 ? intentBlocker(s, { type: 'repair', part: 'hull' }) : null;
  const scan: Intent = session.autoResolveMiniGames ? { type: 'scan' } : { type: 'salvage', skipped: true };
  const disabled: (string | null)[] = [null, null, null, null, null, null, repairReason, intentBlocker(s, scan)];
  return labels.map((label, i) => ({ label, disabled: disabled[i] ?? null }));
}

/** A sub-menu option and the intent it dispatches. */
export interface Option {
  item: MenuItem;
  intent: Intent;
}

export function thrustOptions(): Option[] {
  return THRUST_ORDER.map((id) => {
    const th = THRUST[id];
    return { item: { label: t('travel.thrustOption', { name: th.name, mk: th.mkPerDay, health: th.health }) }, intent: { type: 'setThrust', thrust: id } };
  });
}

export function rationOptions(s: GameState): Option[] {
  return RATION_ORDER.map((id) => {
    const days = daysOfRations(s, id);
    const n = Number.isFinite(days) ? fmt(days) : '-';
    return { item: { label: t('travel.rationOption', { name: RATIONS[id].name, n }) }, intent: { type: 'setRations', rations: id } };
  });
}

export function repairOptions(s: GameState): Option[] {
  return brokenParts(s).map((part: PartId) => {
    const intent: Intent = { type: 'repair', part };
    return { item: { label: t('travel.repairOption', { part: PART_NAMES[part], n: sparesFor(s, part) }), disabled: intentBlocker(s, intent) }, intent };
  });
}

/** Most recent log lines (newest last). */
export function recentLog(s: GameState, count = 6): string[] {
  return s.log.slice(-count).map((e) => e.text);
}
