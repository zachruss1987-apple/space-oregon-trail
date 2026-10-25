/**
 * Hazard crossing (hazards.md "Flow"): shown while `state.crossing !== null`. Readout, the four options with risk words
 * or blockers, Rest, and a way to the travel menu (repairs). Choosing dispatches `cross`; pilot waits and rests replay
 * day by day; the outcome shows in a modal, then Travel (or the ending; or this scene again if the crossing is pending).
 * Thread it opens Debris Threading (Ride the solar wind: the Flare Belt) unless mini-games auto-resolve; the mini-game
 * returns here with `session.pendingDay`, which is replayed like a crossing.
 */
import type Phaser from 'phaser';
import { REST, WAYPOINTS } from '@/content';
import { session } from '@/game/session';
import { mt } from '@/minigames/copy';
import { MINIGAME_SCENES } from '@/minigames/outcome';
import { applyAction, intentBlocker, type Intent, type LogEntry } from '@/sim';
import { t } from '@/ui/copy';
import { DayLog } from '@/ui/DayLog';
import { Menu, type MenuItem } from '@/ui/Menu';
import { promptNumber } from '@/ui/NumberPrompt';
import { panel } from '@/ui/chrome';
import { addText, setText } from '@/ui/text';
import { COLORS } from '@/ui/theme';
import { artBand } from './artBand';
import { BaseScene } from './BaseScene';
import { atFlareBelt, optionKey, optionRows, outcomeLines, readoutLines, type HazardRow } from './hazardView';
import { MODAL_KINDS } from './travelView';

const MENU_Y = 150;

export class HazardScene extends BaseScene {
  private rows: HazardRow[] = [];
  private menu!: Menu;
  private desc!: Phaser.GameObjects.BitmapText;
  private log!: DayLog;

  constructor() {
    super('Hazard');
  }

  protected override music(): string {
    return 'hazard';
  }

  create(): void {
    this.begin();
    const s = session.state;
    if (!s) return this.go('Title');
    const back = session.pendingDay;
    if (back) {
      session.pendingDay = null;
      return this.replay(back.entries);
    }
    if (s.status !== 'traveling') return this.ending();
    if (!s.crossing) return this.go('Travel');
    const w = WAYPOINTS[s.crossing.waypoint]!;
    // The hazard's composition (rocks, arcs, walls) behind the name (art.md "Hazards reuse parts").
    artBand(this, w.index, { h: 60, artX: 470, artW: 340, title: w.name.toUpperCase(), sub: t('hazard.title') });
    readoutLines(s).forEach((line, i) => addText(this, 24, 70 + i * 18, line, { color: COLORS.text }));
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
    this.desc = addText(this, 24, MENU_Y + items.length * 22 + 24, '', { color: COLORS.dim, wrap: 592 });
    panel(this, 0, 336, 640, 64);
    this.log = new DayLog(this, 14, 346, 612, 3);
    this.log.show(s.log.slice(-3).map((e) => e.text));
    this.router.push({ onKey: (e) => !this.log.busy && this.menu.onKey(e) });
    this.describe(first);
  }

  private describe(i: number): void {
    const row = this.rows[i];
    setText(this.desc, row ? mt(optionKey(session.state!, row.method, 'desc')) : '');
  }

  /** Back from a mini-game: its crossing already ran in the sim; play the entries, then the outcome modal and routing. */
  private replay(entries: LogEntry[]): void {
    const s = session.state!;
    const w = WAYPOINTS[s.arrivedAt ?? s.segment];
    artBand(this, w?.index ?? 0, { h: 60, artX: 470, artW: 340, title: (w?.name ?? '').toUpperCase() });
    panel(this, 0, 336, 640, 64);
    this.log = new DayLog(this, 14, 346, 612, 3);
    this.log.play(entries, () => this.after(entries, true));
  }

  private select(i: number): void {
    const row = this.rows[i];
    if (row?.method === 'thread' && !session.autoResolveMiniGames) return this.launchMiniGame();
    if (row) return this.dispatch({ type: 'cross', method: row.method });
    if (i === this.rows.length) {
      return promptNumber(this, this.router, t('travel.restPrompt'), { min: REST.minDays, max: REST.maxDays }, (days) => {
        if (days !== null) this.dispatch({ type: 'rest', days });
      });
    }
    this.go('Travel');
  }

  /** Thread it as a mini-game: Debris Threading, or the Flare Belt Finale at waypoint 15. */
  private launchMiniGame(): void {
    const s = session.state!;
    const error = intentBlocker(s, { type: 'cross', method: 'thread' });
    if (error) return this.menu.say(error);
    this.scene.start(MINIGAME_SCENES[atFlareBelt(s) ? 'flare' : 'threading'], { returnTo: 'Hazard' });
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
