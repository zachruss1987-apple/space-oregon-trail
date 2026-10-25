/**
 * Hazard crossing (hazards.md "Flow"): shown while `state.crossing !== null`. Readout, the four options with risk words
 * or blockers, Rest, and a way to the travel menu (repairs). Choosing dispatches `cross`; pilot waits and rests replay
 * day by day; the outcome shows in a modal, then Travel (or the ending; or this scene again if the crossing is pending).
 */
import Phaser from 'phaser';
import { REST, WAYPOINTS } from '@/content';
import { session } from '@/game/session';
import { applyAction, type Intent, type LogEntry } from '@/sim';
import { t } from '@/ui/copy';
import { DayLog } from '@/ui/DayLog';
import { Menu, type MenuItem } from '@/ui/Menu';
import { promptNumber } from '@/ui/NumberPrompt';
import { COLORS, panel, textStyle } from '@/ui/theme';
import { BaseScene } from './BaseScene';
import { optionRows, outcomeLines, readoutLines, type HazardRow } from './hazardView';
import { MODAL_KINDS } from './travelView';

const MENU_Y = 150;

export class HazardScene extends BaseScene {
  private rows: HazardRow[] = [];
  private menu!: Menu;
  private desc!: Phaser.GameObjects.Text;
  private log!: DayLog;

  constructor() {
    super('Hazard');
  }

  create(): void {
    this.begin();
    const s = session.state;
    if (!s) return this.go('Title');
    if (s.status !== 'traveling') return this.ending();
    if (!s.crossing) return this.go('Travel');
    const w = WAYPOINTS[s.crossing.waypoint]!;
    panel(this, 4, 4, 632, 52, true);
    this.heading(12, w.name.toUpperCase(), 18);
    this.heading(36, t('hazard.title'), 12, COLORS.dim);
    readoutLines(s).forEach((line, i) => this.add.text(24, 66 + i * 20, line, textStyle(COLORS.text)));
    this.rows = optionRows(s);
    const items: MenuItem[] = [...this.rows.map((r) => r.item), { label: t('hazard.option.rest') }, { label: t('hazard.other') }];
    const first = Math.max(0, items.findIndex((it) => !it.disabled));
    this.menu = new Menu(this, items, {
      x: 10,
      y: MENU_Y,
      numbered: true,
      lineHeight: 22,
      cursor: first,
      onMove: (i) => this.describe(i),
      onSelect: (i) => this.select(i),
    });
    this.desc = this.add.text(24, MENU_Y + items.length * 22 + 24, '', textStyle(COLORS.dim, 592, 12));
    panel(this, 4, 324, 632, 72, true);
    this.log = new DayLog(this, 14, 330, 612, 3);
    this.log.show(s.log.slice(-3).map((e) => e.text));
    this.router.push({ onKey: (e) => !this.log.busy && this.menu.onKey(e) });
    this.describe(first);
  }

  private describe(i: number): void {
    const row = this.rows[i];
    this.desc.setText(row ? t(`hazard.desc.${row.method}`) : '');
  }

  private select(i: number): void {
    const row = this.rows[i];
    if (row) return this.dispatch({ type: 'cross', method: row.method });
    if (i === this.rows.length) {
      return promptNumber(this, this.router, t('travel.restPrompt'), { min: REST.minDays, max: REST.maxDays }, (days) => {
        if (days !== null) this.dispatch({ type: 'rest', days });
      });
    }
    this.go('Travel');
  }

  private dispatch(intent: Intent): void {
    const r = applyAction(session.state!, intent, session.rng);
    if (r.error) return this.menu.say(r.error);
    session.state = r.state;
    this.log.play(r.entries, () => this.after(r.entries, intent.type === 'cross'));
  }

  /** Outcome modal (crossing) or event/death modal (rest), then route by state. */
  private after(entries: LogEntry[], crossed: boolean): void {
    const s = session.state!;
    const lines = crossed ? outcomeLines(entries) : entries.filter((e) => MODAL_KINDS.has(e.kind)).map((e) => e.text);
    const next = (): void => {
      if (s.status !== 'traveling') this.ending();
      else if (s.crossing) this.scene.restart();
      else this.go('Travel');
    };
    if (lines.length > 0) this.modal(lines.join('\n\n'), { onClose: next });
    else next();
  }
}
