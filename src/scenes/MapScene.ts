/** Look at the map: progress bar and the 17 waypoints (docs/design/ui.md). No day passes; Enter/Esc returns. */
import { TOTAL_MK, WAYPOINTS, type Waypoint } from '@/content';
import { session } from '@/game/session';
import { remainingInSegment, type GameState } from '@/sim';
import { t } from '@/ui/copy';
import { Table } from '@/ui/Table';
import { COLORS, fmt, textStyle } from '@/ui/theme';
import { BaseScene } from './BaseScene';

const BAR_CELLS = 34;

/** `[#####>.....]`: one # per 1/34 of the Lane covered, > at the ship. */
export function progressBar(distance: number): string {
  const filled = Math.min(BAR_CELLS - 1, Math.floor((distance / TOTAL_MK) * BAR_CELLS));
  return `[${'#'.repeat(filled)}>${'.'.repeat(BAR_CELLS - 1 - filled)}]`;
}

function typeName(w: Waypoint): string {
  return t(`map.type.${w.type === 'start' ? 'station' : w.type}`);
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
    this.add.text(16, 10, t('map.title'), textStyle(COLORS.bright));
    this.add.text(624, 10, `${fmt(s.distanceTotal)} / ${fmt(TOTAL_MK)} ${t('status.units.mk')}`, textStyle(COLORS.text)).setOrigin(1, 0);
    this.add.text(16, 30, progressBar(s.distanceTotal), textStyle(COLORS.text));
    const rows = WAYPOINTS.map((w) => ({
      cells: [String(w.index), w.name, typeName(w), fmt(w.cumulative), statusFor(s, w)],
      color: w.index === s.segment || w.index === s.arrivedAt ? COLORS.bright : w.index < s.segment ? COLORS.dim : COLORS.text,
    }));
    new Table(this, 16, 52, [{ width: 2, right: true }, { width: 25 }, { width: 9 }, { width: 6, right: true }, { width: 14 }], 18)
      .setRows(rows, ['#', t('map.col.waypoint'), t('map.col.type'), t('status.units.mk'), '']);
    this.router.push({
      onKey: (e) => {
        if ((e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') && !e.repeat) this.go('Travel');
      },
    });
  }
}
