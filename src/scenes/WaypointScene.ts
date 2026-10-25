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
import { audio } from '@/audio/AudioManager';
import { addText, lineCount, linePitch } from '@/ui/text';
import { COLORS, LINE_HEIGHT } from '@/ui/theme';
import { artBand } from './artBand';
import { BaseScene, type SceneKey } from './BaseScene';

const MENU_LH = 22;
const BAND_H = 132;

export class WaypointScene extends BaseScene {
  constructor() {
    super('Waypoint');
  }

  protected override music(): string {
    const s = session.state;
    const w = WAYPOINTS[s?.arrivedAt ?? session.shownWaypoint ?? -1];
    return w && isStation(w) ? 'station' : 'travel';
  }

  create(): void {
    this.begin();
    const s = session.state;
    const index = s?.arrivedAt ?? session.shownWaypoint;
    const w = index !== null && index !== undefined ? WAYPOINTS[index] : undefined;
    if (!s || !w) return this.go(s ? 'Travel' : 'Title');
    const { blurb, line } = bulletin(w.id);
    // Full-size waypoint art in the band (art.md checklist "Waypoint").
    artBand(this, w.index, { h: BAND_H, artX: 500, artW: 260, title: w.name.toUpperCase(), sub: w.subtitle });
    const body = new TextBox(this, 24, BAND_H + 8, 592, blurb, { typewriter: true });
    let y = BAND_H + 8 + body.lineCount() * LINE_HEIGHT + 8;
    addText(this, 24, y, t('waypoint.bulletin'), { color: COLORS.dim });
    const bulletinBox = new TextBox(this, 24, y + LINE_HEIGHT, 592, line, { color: COLORS.text });
    y += LINE_HEIGHT + bulletinBox.lineCount() * LINE_HEIGHT + 8;
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
      hints: () => menu.hintSet,
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
    addText(this, 24, y, t('waypoint.beacons'), { color: COLORS.dim });
    y += LINE_HEIGHT;
    audio().sfx('beacon.chime');
    for (const b of list) {
      const line = formatBeacon(b);
      // a small memorial beacon beside each epitaph
      this.add.image(24, y, 'beacon', 0).setOrigin(0, 0);
      addText(this, 44, y + 4, line, { color: COLORS.bright, wrap: 572 });
      y += Math.max(24, lineCount(line, 572) * linePitch() + 4) + 2;
    }
    return y;
  }
}
