/**
 * Arrival at a waypoint: blurb + a bulletin line. Hazards: while `state.crossing` is pending, an INTERIM menu offers
 * Thread it / Hire a tug (the M2 HazardScene replaces it); once crossed, the narration and outcome show in a modal.
 */
import { isStation, WAYPOINTS } from '@/content';
import { session } from '@/game/session';
import { applyAction, crossingOptions, type Intent } from '@/sim';
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
    if (s.crossing) return this.crossingMenu(body);
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
      // The crossing was resolved by a `cross` intent today; show its narration and outcome.
      const outcome = s.log.filter((e) => (e.kind === 'crossing' || e.kind === 'hazard') && e.day === s.day).map((e) => e.text);
      body.finish();
      this.modal(outcome.join('\n\n') || blurb);
    }
  }

  /** Interim crossing choice (Thread it, Hire a tug), enabled rows first; if both are blocked, rest a day. */
  private crossingMenu(body: TextBox): void {
    const rows: { item: MenuItem; intent: Intent }[] = crossingOptions(session.state!)
      .filter((o) => o.method === 'thread' || o.method === 'tug')
      .map((o) => ({
        item: { label: o.method === 'tug' ? `${t('hazard.option.tug')} (${o.price} cr)` : t('hazard.option.thread'), disabled: o.blocker },
        intent: { type: 'cross', method: o.method },
      }));
    rows.sort((a, b) => Number(Boolean(a.item.disabled)) - Number(Boolean(b.item.disabled)));
    if (rows.every((r) => r.item.disabled)) rows.unshift({ item: { label: 'Rest a day' }, intent: { type: 'rest', days: 1 } });
    const menu = new Menu(this, rows.map((r) => r.item), {
      x: 24,
      y: 300,
      numbered: true,
      lineHeight: 22,
      onSelect: (i) => {
        const r = applyAction(session.state!, rows[i]!.intent, session.rng);
        if (r.error) return menu.say(r.error);
        session.state = r.state;
        if (r.state.status !== 'traveling') return this.go('Travel');
        this.scene.restart();
      },
    });
    this.router.push({
      onKey: (e) => {
        if (body.typing) body.finish();
        menu.onKey(e);
      },
    });
  }
}
