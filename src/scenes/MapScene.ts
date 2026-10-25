/**
 * Look at the map: progress bar and the waypoints of the active route (docs/design/ui.md, hazards.md "Route branch").
 * Before the Titan Refinery choice both branches are listed; on the direct route Oort Beacon is marked skipped.
 * No day passes; Enter/Esc returns.
 */
import { ROUTE, WAYPOINTS, type Waypoint } from '@/content';
import { session } from '@/game/session';
import { isSkipped, remainingInSegment, routeWaypoints, totalMk, type GameState } from '@/sim';
import { t } from '@/ui/copy';
import { Table } from '@/ui/Table';
import { COLORS, fmt, textStyle } from '@/ui/theme';
import { BaseScene } from './BaseScene';

const BAR_CELLS = 34;

/** `[#####>.....]`: one # per 1/34 of the route covered, > at the ship. */
export function progressBar(distance: number, total: number): string {
  const filled = Math.max(0, Math.min(BAR_CELLS - 1, Math.floor((distance / total) * BAR_CELLS)));
  return `[${'#'.repeat(filled)}>${'.'.repeat(BAR_CELLS - 1 - filled)}]`;
}

function typeName(w: Waypoint): string {
  return t(`map.type.${w.type === 'start' ? 'station' : w.type}`);
}

/** Has the ship left Titan Refinery (the route is locked)? */
function pastBranch(s: GameState): boolean {
  return (s.arrivedAt ?? s.segment) > ROUTE.branchAt;
}

function statusFor(s: GameState, w: Waypoint): string {
  if (s.arrivedAt === w.index) return t('map.here');
  if (w.index < s.segment) return t('map.passed');
  if (w.index === s.segment) return t('map.next', { n: fmt(remainingInSegment(s)) });
  return '';
}

export class MapScene extends BaseScene {
  constructor() {
    super('Map');
  }

  create(): void {
    this.begin();
    const s = session.state;
    if (!s) return this.go('Title');
    const total = totalMk(s.route);
    this.add.text(16, 10, t('map.title'), textStyle(COLORS.bright));
    this.add.text(624, 10, `${fmt(s.distanceTotal)} / ${fmt(total)} ${t('status.units.mk')}`, textStyle(COLORS.text)).setOrigin(1, 0);
    this.add.text(16, 30, progressBar(s.distanceTotal, total), textStyle(COLORS.text));
    // Active route list, with the skipped Oort Beacon put back in place (marked) when direct.
    const active = routeWaypoints(s.route);
    const shown = WAYPOINTS.map((w) => active.find((a) => a.index === w.index) ?? w);
    const rows = shown.map((w) => {
      const skipped = isSkipped(w.index, s.route);
      return {
        cells: [String(w.index), w.name, typeName(w), skipped ? '' : fmt(w.cumulative), skipped ? t('map.skipped') : statusFor(s, w)],
        color: skipped ? COLORS.dim : w.index === s.segment || w.index === s.arrivedAt ? COLORS.bright : w.index < s.segment ? COLORS.dim : COLORS.text,
      };
    });
    const table = new Table(this, 16, 52, [{ width: 2, right: true }, { width: 25 }, { width: 9 }, { width: 6, right: true }, { width: 14 }], 18);
    table.setRows(rows, ['#', t('map.col.waypoint'), t('map.col.type'), t('status.units.mk'), '']);
    if (!pastBranch(s)) {
      const line = t('map.branch', {
        oortLabel: t('route.oortLabel'), oort: fmt(totalMk('oort')), directLabel: t('route.directLabel'), direct: fmt(totalMk('direct')),
      });
      this.add.text(16, table.bottom + 2, line, textStyle(COLORS.dim, 608, 12));
    }
    this.router.push({
      onKey: (e) => {
        if ((e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') && !e.repeat) this.go('Travel');
      },
    });
  }
}
