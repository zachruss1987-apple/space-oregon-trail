/** Pure view helpers for HazardScene: the readout lines and option rows (hazards.md "Readout"). Sim helpers only. */
import { CROSSING, WAYPOINTS } from '@/content';
import { mt } from '@/minigames/copy';
import { crossingOptions, densityTrend, isFlareBelt, workingDrives, type CrossMethod, type GameState, type LogEntry } from '@/sim';
import { t } from '@/ui/copy';
import type { MenuItem } from '@/ui/Menu';
import { col, money } from '@/ui/theme';

const LABEL_W = 39;

/** Density, ship and funds lines for the pending crossing. */
export function readoutLines(s: GameState): string[] {
  const c = s.crossing;
  if (!c) return [];
  const L = (k: string): string => t(`hazard.label.${k}`);
  const max = CROSSING.densityMax;
  const density = t('hazard.densityLine', {
    label: L('density'), n: c.density, max, trend: t(`hazard.density.${densityTrend(c)}`),
    bar: '#'.repeat(c.density) + '.'.repeat(Math.max(0, max - c.density)),
  });
  const part = (k: 'hull' | 'pump' | 'gyro'): string => `${L(k)} ${s.broken[k] ? L('broken') : L('sound')}`;
  const ship = `${L('ship')}: ${part('hull')}  ${part('pump')}  ${part('gyro')}  ${L('drives')} ${workingDrives(s)} ${L('working')}`;
  return [density, ship, t('hazard.fundsLine', { label: L('funds'), n: money(s.credits) })];
}

/** One option row and the method it dispatches. */
export interface HazardRow {
  item: MenuItem;
  method: CrossMethod;
}

/** True when the pending crossing is the Flare Belt finale (minigames.md section 3). */
export function atFlareBelt(s: GameState): boolean {
  return s.crossing !== null && isFlareBelt(WAYPOINTS[s.crossing.waypoint]!);
}

/** ui text key for an option's label / description (the Flare Belt lists Ride the solar wind / Pay the tug). */
export function optionKey(s: GameState, method: CrossMethod, part: 'option' | 'desc'): string {
  if (!atFlareBelt(s)) return `hazard.${part}.${method}`;
  if (method === 'thread') return `hazard.${part}.ride`;
  return part === 'option' && method === 'tug' ? 'hazard.option.payTug' : `hazard.${part}.${method}`;
}

/**
 * The options: label with terms, then the risk word, or the blocker (dimmed) instead. Four at the hazards; at the
 * Flare Belt only Ride the solar wind (thread) and Pay the tug (minigames.md section 3).
 */
export function optionRows(s: GameState): HazardRow[] {
  const pilotDays = s.crossing?.pilotDaysLeft ?? null;
  const flare = atFlareBelt(s);
  return crossingOptions(s).filter((o) => !flare || o.method === 'thread' || o.method === 'tug').map((o) => {
    const name = mt(optionKey(s, o.method, 'option'));
    let label = name;
    if (o.method === 'tug' && o.price !== undefined) label = t('hazard.tugTerms', { label: name, n: money(o.price) });
    if (o.method === 'pilot' && o.waitDays !== undefined) {
      label = pilotDays !== null
        ? t('hazard.pilotPending', { label: name, n: pilotDays })
        : t('hazard.pilotTerms', { label: name, n: o.waitDays, fee: CROSSING.pilot.fee });
    }
    const tail = o.blocker ?? (o.risk ? `${t('hazard.label.risk')}: ${t(`hazard.risk.${o.risk}`)}` : '');
    return { item: { label: `${col(label, LABEL_W)} ${tail}`, disabled: o.blocker }, method: o.method };
  });
}

/** Lines for the outcome modal: narration, outcome, pump strain, plus any event/condition/death on the way. */
export function outcomeLines(entries: readonly LogEntry[]): string[] {
  return entries
    .filter((e) => {
      if (e.kind === 'crossing') return e.id !== 'pilot' && e.id !== 'pilot-wait';
      return ['hazard', 'death', 'event', 'condition', 'threading', 'flare', 'info'].includes(e.kind);
    })
    .map((e) => e.text);
}
