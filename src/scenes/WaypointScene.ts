/** Arrival at a waypoint: blurb + a bulletin line; hazards first show the crossing outcome in a modal. */
import { isStation, WAYPOINTS } from '@/content';
import { session } from '@/game/session';
import { bulletin, t } from '@/ui/copy';
import { Menu, type MenuItem } from '@/ui/Menu';
import { TextBox } from '@/ui/TextBox';
import { COLORS, panel, textStyle } from '@/ui/theme';
import { BaseScene } from './BaseScene';

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
    const body = new TextBox(this, 24, 96, 592, blurb, { typewriter: true });
    this.add.text(24, 200, t('waypoint.bulletin'), textStyle(COLORS.dim));
    new TextBox(this, 24, 220, 592, line, { color: COLORS.text });
    const items: MenuItem[] = [{ label: t('waypoint.continue') }];
    if (isStation(w)) items.push({ label: t('waypoint.enter') });
    const menu = new Menu(this, items, {
      x: 24,
      y: 300,
      numbered: true,
      lineHeight: 22,
      onSelect: (i) => {
        if (i === 0) this.go('Travel');
        else this.modal(t('waypoint.storeLater'));
      },
      onBack: () => this.go('Travel'),
    });
    this.router.push({
      onKey: (e) => {
        if (body.typing) body.finish();
        menu.onKey(e);
      },
    });
    if (w.type === 'hazard') {
      // The crossing was rolled on the arrival tick; its outcome is the hazard entry of that day.
      const outcome = s.log.filter((e) => e.kind === 'hazard' && e.day === s.day).map((e) => e.text);
      body.finish();
      this.modal(outcome.join('\n\n') || blurb);
    }
  }
}
