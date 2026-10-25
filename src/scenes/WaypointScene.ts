/**
 * Arrival at a waypoint: blurb, a bulletin line, up to 3 memorial beacons (beacons.md). Hazard with a pending crossing:
 * "Approach the crossing" opens the Hazard scene. Road station: "Enter station" opens the Station scene. At Titan
 * Refinery, Continue asks the route first.
 */
import { isStation, WAYPOINTS } from '@/content';
import { session } from '@/game/session';
import { beaconsForSegment, formatBeacon, stationOpen } from '@/sim';
import { loadBeacons } from '@/ui/beaconStore';
import { bulletin, t } from '@/ui/copy';
import { Menu, type MenuItem } from '@/ui/Menu';
import { TextBox } from '@/ui/TextBox';
import { COLORS, LINE_HEIGHT, panel, textStyle } from '@/ui/theme';
import { BaseScene, type SceneKey } from './BaseScene';

const MENU_LH = 22;
const BEACON_LH = 15;

export class WaypointScene extends BaseScene {
  constructor() {
    super('Waypoint');
  }

  create(): void {
    this.begin();
    const s = session.state;
    const index = s?.arrivedAt ?? session.shownWaypoint;
    const w = index !== null && index !== undefined ? WAYPOINTS[index] : undefined;
    if (!s || !w) return this.go(s ? 'Travel' : 'Title');
    const { blurb, line } = bulletin(w.id);
    panel(this, 4, 4, 632, 72, true);
    this.heading(18, w.name.toUpperCase(), 18);
    if (w.subtitle) this.heading(46, w.subtitle, 12, COLORS.dim);
    const body = new TextBox(this, 24, 88, 592, blurb, { typewriter: true });
    let y = 88 + body.lineCount() * LINE_HEIGHT + 10;
    this.add.text(24, y, t('waypoint.bulletin'), textStyle(COLORS.dim));
    const bulletinBox = new TextBox(this, 24, y + LINE_HEIGHT, 592, line, { color: COLORS.text });
    y += LINE_HEIGHT + bulletinBox.lineCount() * LINE_HEIGHT + 10;
    y = this.beacons(w.index, y);

    const rows: { item: MenuItem; to: SceneKey | 'route' }[] = [];
    if (s.crossing) rows.push({ item: { label: t('waypoint.cross') }, to: 'Hazard' });
    else rows.push({ item: { label: t('waypoint.continue') }, to: 'route' });
    if (isStation(w) && stationOpen(s)) rows.push({ item: { label: t('waypoint.enter') }, to: 'Station' });
    const menuY = Math.max(y + 8, 400 - rows.length * MENU_LH - 24);
    const menu = new Menu(this, rows.map((r) => r.item), {
      x: 24,
      y: menuY,
      numbered: true,
      lineHeight: MENU_LH,
      onSelect: (i) => {
        const to = rows[i]!.to;
        if (to === 'route') this.askRoute(() => this.go('Travel'));
        else this.go(to);
      },
      onBack: () => this.go(s.crossing ? 'Hazard' : 'Travel'),
    });
    this.router.push({
      onKey: (e) => {
        if (body.typing) body.finish();
        menu.onKey(e);
      },
    });
  }

  /** "Memorial beacons" and up to 3 lines for this waypoint (player first, canned fill); returns the next y. */
  private beacons(index: number, y: number): number {
    const list = beaconsForSegment(loadBeacons(), index, session.uiRng);
    if (list.length === 0) return y;
    this.add.text(24, y, t('waypoint.beacons'), textStyle(COLORS.dim));
    y += LINE_HEIGHT;
    for (const b of list) {
      const text = this.add.text(24, y, formatBeacon(b), textStyle(COLORS.bright, 592, 12));
      text.setLineSpacing(BEACON_LH - 12);
      y += text.height + 4;
    }
    return y;
  }
}
