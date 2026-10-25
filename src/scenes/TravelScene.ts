/**
 * The travel loop: status panel, log, the eight actions. Continue/auto-travel advance days through applyAction.
 * Routing by sim state: arrival -> Waypoint; a refused Continue with a pending crossing -> Hazard, or stranded at a
 * station -> Station; endings -> Death/Arrival.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { REST, WAYPOINTS } from '@/content';
import { markFlag } from '@/game/contract';
import { session } from '@/game/session';
import { applyAction, makeBeacon, newlyDead, stationOpen, type Intent, type LogEntry } from '@/sim';
import { outcomeIntent } from '@/minigames/outcome';
import { promptBeacon } from '@/ui/BeaconPrompt';
import { saveBeacon } from '@/ui/beaconStore';
import { t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { promptNumber } from '@/ui/NumberPrompt';
import { StatusBar } from '@/ui/StatusBar';
import { TextBox } from '@/ui/TextBox';
import { COLORS, panel, textStyle } from '@/ui/theme';
import { BaseScene } from './BaseScene';
import { actionItems, MODAL_KINDS, rationOptions, recentLog, repairOptions, statusRows, STOP_KINDS, thrustOptions, type Option } from './travelView';

const BAND_H = 132;
const MENU_Y = 204;
const LOG_X = 332;
const LOG_W = 296;
const LOG_LINES = 9;

export class TravelScene extends BaseScene {
  private menu!: Menu;
  private status!: StatusBar;
  private log!: TextBox;
  private bandLabel!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private stars: Phaser.GameObjects.Rectangle[] = [];
  private busy = false;
  private auto = false;
  /** Auto-travel started by holding Enter (stops on key up). */
  private holding = false;

  constructor() {
    super('Travel');
  }

  create(): void {
    this.begin();
    this.busy = false;
    this.auto = false;
    this.holding = false;
    const s = session.state;
    if (!s) return this.go('Title');
    if (s.status !== 'traveling') return this.ending();
    this.drawBand();
    panel(this, 4, BAND_H + 2, GAME_WIDTH - 8, 60, true);
    this.status = new StatusBar(this, 12, BAND_H + 8, [26, 22, 22]);
    panel(this, 4, MENU_Y - 6, GAME_WIDTH - 8, GAME_HEIGHT - MENU_Y + 2, true);
    this.log = new TextBox(this, LOG_X, MENU_Y, LOG_W, '');
    this.menu = new Menu(this, actionItems(s), { x: 10, y: MENU_Y, numbered: true, lineHeight: 20, onSelect: (i) => this.act(i) });
    this.hint = this.add.text(10, GAME_HEIGHT - 16, t('travel.auto'), textStyle(COLORS.dim, undefined, 11));
    this.router.push({ onKey: (e) => this.onKey(e), onKeyUp: (e) => this.onKeyUp(e) });
    this.render();
    const back = session.pendingDay;
    if (back) {
      // Returning from a mini-game: its day already ran in the sim; route it like any other day.
      session.pendingDay = null;
      this.setBusy(true);
      this.afterDay(back.entries, back.dead);
    } else if (session.departOnTravel) {
      // The Station scene's Continue: run the departing day here so its events and arrival route normally.
      session.departOnTravel = false;
      this.travelDay();
    }
  }

  override update(_time: number, delta: number): void {
    if (!this.busy && !this.auto) return;
    for (const st of this.stars) {
      st.x -= (delta / 1000) * (40 + st.width * 40);
      if (st.x < 0) st.x += GAME_WIDTH;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (this.auto) {
      if (!(e.key === 'Enter' && e.repeat)) this.setAuto(false);
      return;
    }
    if (this.busy) return;
    if (e.key === 'Enter' && e.repeat && this.menu.cursor === 0) {
      this.holding = true;
      this.setAuto(true);
    } else if (e.key === 't' || e.key === 'T') this.setAuto(true);
    else this.menu.onKey(e);
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Enter' && this.holding) this.setAuto(false);
  }

  private setAuto(on: boolean): void {
    this.auto = on;
    if (!on) this.holding = false;
    this.hint.setText(on ? t('travel.autoIndicator') : t('travel.auto'));
    if (on && !this.busy) this.travelDay();
  }

  private render(): void {
    const s = session.state!;
    this.status.set(statusRows(s));
    this.menu.setItems(actionItems(s));
    this.menu.say('');
    const parked = s.arrivedAt !== null ? WAYPOINTS[s.arrivedAt] : undefined;
    this.bandLabel.setText(parked ? parked.name : (WAYPOINTS[s.segment]?.name ?? ''));
    let lines = recentLog(s);
    this.log.set(lines.join('\n'));
    while (lines.length > 1 && this.log.lineCount() > LOG_LINES) {
      lines = lines.slice(1);
      this.log.set(lines.join('\n'));
    }
  }

  private act(i: number): void {
    const s = session.state!;
    switch (i) {
      case 0: return this.travelDay();
      case 1: return this.go('Supplies');
      case 2: return this.go('Map');
      case 3: return this.choose(t('travel.thrustPrompt'), thrustOptions());
      case 4: return this.choose(t('travel.rationsPrompt'), rationOptions(s));
      case 5:
        return promptNumber(this, this.router, t('travel.restPrompt'), { min: REST.minDays, max: REST.maxDays }, (days) => {
          if (days !== null) this.dispatch({ type: 'rest', days }, true);
        });
      case 6: return this.choose(t('travel.repairPrompt'), repairOptions(s), true);
      case 7: return this.scan();
    }
  }

  /** Scan for salvage: the Salvage Run, or the statistical scan when mini-games auto-resolve (minigames.md). */
  private scan(): void {
    const auto = session.autoResolveMiniGames;
    this.modal(auto ? t('travel.scanConfirm') : t('minigame.salvage.confirm'), {
      buttons: [t('common.yes'), t('common.no')],
      onClose: (b) => {
        if (b !== 0) return;
        if (auto) this.dispatch(outcomeIntent('salvage', { auto: true }), true);
        else this.scene.start('Salvage', { returnTo: 'Travel' });
      },
    });
  }

  /** Sub-menu modal: options + Cancel. */
  private choose(prompt: string, options: Option[], takesDay = false): void {
    this.modal(prompt, {
      buttons: [...options.map((o) => o.item), t('travel.cancel')],
      onClose: (b) => {
        const o = options[b];
        if (o) this.dispatch(o.intent, takesDay);
      },
    });
  }

  /** One Continue: short "rolling" delay, then a day. */
  private travelDay(): void {
    this.setBusy(true);
    this.time.delayedCall(session.settings.dayDelayMs, () => this.dispatch({ type: 'continue' }, true));
  }

  private setBusy(on: boolean): void {
    this.busy = on;
    markFlag('busy', on);
  }

  private dispatch(intent: Intent, takesDay: boolean): void {
    const before = session.state!;
    const r = applyAction(before, intent, session.rng);
    if (r.error) {
      this.setBusy(false);
      this.setAuto(false);
      if (intent.type === 'continue' && this.routeParked()) return;
      this.menu.say(r.error);
      return;
    }
    session.state = r.state;
    this.render();
    if (takesDay) this.afterDay(r.entries, newlyDead(before, r.state));
    else this.setBusy(false);
  }

  /** A refused Continue while parked: a pending crossing goes to the Hazard scene, a stranded station stop to the Station. */
  private routeParked(): boolean {
    const s = session.state!;
    if (s.crossing) this.go('Hazard');
    else if (stationOpen(s)) this.go('Station');
    else return false;
    return true;
  }

  /** Route after a day: endings, event modal, waypoint arrival, or keep auto-traveling. */
  private afterDay(entries: LogEntry[], dead: string[]): void {
    const s = session.state!;
    if (s.status !== 'traveling') {
      this.setAuto(false);
      this.setBusy(true);
      this.time.delayedCall(900, () => this.ending());
      return;
    }
    const arrived = s.arrivedAt !== null && s.arrivedAt !== session.shownWaypoint;
    if (entries.some((e) => STOP_KINDS.has(e.kind))) this.setAuto(false);
    const next = (): void => this.beaconsThen(dead, proceed);
    const proceed = (): void => {
      if (arrived) {
        session.shownWaypoint = s.arrivedAt;
        this.go('Waypoint');
      } else if (this.auto) this.travelDay();
      else this.setBusy(false);
    };
    const shown = entries.filter((e) => MODAL_KINDS.has(e.kind));
    if (shown.length > 0) {
      this.setBusy(false);
      this.modal(shown.map((e) => e.text).join('\n\n'), { onClose: next });
    } else next();
  }

  /** One memorial beacon prompt per crew death this action (the run continues), then `done`. */
  private beaconsThen(dead: string[], done: () => void): void {
    const [name, ...rest] = dead;
    if (name === undefined) return done();
    promptBeacon(this, this.router, name, (text) => {
      if (text) saveBeacon(makeBeacon(session.state!, name, text));
      this.beaconsThen(rest, done);
    });
  }

  /** Placeholder landmark band: starfield, the ship, destination name (art in M4). */
  private drawBand(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, BAND_H, 0x000000).setOrigin(0, 0).setStrokeStyle(1, COLORS.borderDim);
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      const size = session.uiRng.chance(0.2) ? 2 : 1;
      const color = size === 2 ? 0xc8ffc8 : 0x2e8a2e;
      this.stars.push(this.add.rectangle(session.uiRng.int(2, GAME_WIDTH - 2), session.uiRng.int(4, BAND_H - 24), size, size, color));
    }
    this.add.rectangle(GAME_WIDTH / 2 - 10, BAND_H - 18, 20, 6, 0x5cff5c);
    this.bandLabel = this.add.text(GAME_WIDTH - 12, 8, '', textStyle(COLORS.dim)).setOrigin(1, 0);
  }
}
