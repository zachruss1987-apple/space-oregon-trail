/**
 * The travel loop: status panel, log, the eight actions. Continue/auto-travel advance days through applyAction.
 * Routing by sim state: arrival -> Waypoint; a refused Continue with a pending crossing -> Hazard, or stranded at a
 * station -> Station; endings -> Death/Arrival. `drive.hum` loops while a day runs; danger days play the `danger` sting.
 */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
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
import { muteIcon, type MuteIcon } from '@/ui/muteIcon';
import { promptNumber } from '@/ui/NumberPrompt';
import { StatusBar } from '@/ui/StatusBar';
import { TextBox } from '@/ui/TextBox';
import { panel } from '@/ui/chrome';
import { addText, setText } from '@/ui/text';
import { COLORS } from '@/ui/theme';
import { BaseScene } from './BaseScene';
import { dangerSting, hazardArrival } from './stings';
import { TravelBand } from './travelBand';
import { actionItems, MODAL_KINDS, rationOptions, recentLog, repairOptions, statusRows, STOP_KINDS, thrustOptions, type Option } from './travelView';

const STATUS_Y = 142;
const MENU_Y = 204;
const MENU_LH = 18;
const LOG_X = 332;
const LOG_W = 296;
const LOG_LINES = 14;
/** Log kinds that sound the alarm (danger events) when a day brings them. */
const ALARM_KINDS = new Set(['event', 'condition']);
/** Kinds too routine for the new-line ding. */
const QUIET_KINDS = new Set(['travel', 'quiet', 'setting', 'rest', 'weather']);

export class TravelScene extends BaseScene {
  private menu!: Menu;
  private status!: StatusBar;
  private log!: TextBox;
  private bandLabel!: Phaser.GameObjects.BitmapText;
  private hint!: Phaser.GameObjects.BitmapText;
  private band!: TravelBand;
  private mute: MuteIcon | null = null;
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
    this.band = new TravelBand(this, s);
    this.bandLabel = addText(this, GAME_WIDTH - 8, 6, '', { color: COLORS.dim, depth: 8 });
    panel(this, 0, STATUS_Y, GAME_WIDTH, 56);
    this.status = new StatusBar(this, 16, STATUS_Y + 10, [28, 24, 26]);
    panel(this, 0, MENU_Y - 6, GAME_WIDTH, GAME_HEIGHT - MENU_Y + 6);
    this.add.rectangle(LOG_X - 10, MENU_Y, 1, GAME_HEIGHT - MENU_Y - 26, COLORS.borderDim).setOrigin(0, 0);
    this.log = new TextBox(this, LOG_X, MENU_Y + 2, LOG_W, '');
    this.menu = new Menu(this, actionItems(s), { x: 10, y: MENU_Y + 2, numbered: true, lineHeight: MENU_LH, onSelect: (i) => this.act(i) });
    this.hint = addText(this, 12, GAME_HEIGHT - 18, t('travel.auto'), { color: COLORS.dim });
    this.mute = muteIcon(this, 6, 6, 9);
    // `?` (controls overlay) stops auto-travel first: nothing outside the mini-games runs on a timer behind an overlay.
    this.router.push({ onKey: (e) => this.onKey(e), onKeyUp: (e) => this.onKeyUp(e), onHelp: () => this.auto && this.setAuto(false) });
    this.events.off('sleep', this.stopHum, this).on('sleep', this.stopHum, this);
    this.events.once('shutdown', () => {
      this.stopHum();
      this.mute = null;
    });
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

  protected override music(): string {
    return 'travel';
  }

  override update(_time: number, delta: number): void {
    const s = session.state;
    if (!s || !this.band) return;
    this.band.update(delta, s, this.busy || this.auto);
    this.mute?.update();
  }

  /** End the drive-hum bed (day over, scene asleep or gone). */
  private stopHum(): void {
    audio().stopSfx('drive.hum');
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
    setText(this.hint, on ? t('travel.autoIndicator') : t('travel.auto'));
    if (on && !this.busy) this.travelDay();
  }

  private render(): void {
    const s = session.state!;
    this.status.set(statusRows(s));
    this.menu.setItems(actionItems(s));
    this.menu.say('');
    const parked = s.arrivedAt !== null ? WAYPOINTS[s.arrivedAt] : undefined;
    const label = parked ? parked.name : (WAYPOINTS[s.segment]?.name ?? '');
    this.bandLabel.setText(label).setX(GAME_WIDTH - 8 - label.length * 8);
    this.band.refresh(s);
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
    audio().sfx('drive.hum'); // loops until stopSfx (audio.md "drive.hum"); already looping = no restart
    this.time.delayedCall(session.settings.dayDelayMs, () => this.dispatch({ type: 'continue' }, true));
  }

  private setBusy(on: boolean): void {
    this.busy = on;
    markFlag('busy', on);
    if (!on) this.stopHum();
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
      this.stopHum();
      if (dangerSting(entries)) audio().playSting('danger');
      this.time.delayedCall(900, () => this.ending());
      return;
    }
    const arrived = s.arrivedAt !== null && s.arrivedAt !== session.shownWaypoint;
    if (entries.some((e) => STOP_KINDS.has(e.kind))) this.setAuto(false);
    const next = (): void => this.beaconsThen(dead, proceed);
    const proceed = (): void => {
      if (arrived) {
        this.stopHum();
        session.shownWaypoint = s.arrivedAt;
        this.go('Waypoint');
      } else if (this.auto) this.travelDay();
      else this.setBusy(false);
    };
    const shown = entries.filter((e) => MODAL_KINDS.has(e.kind));
    if (dangerSting(entries) || (arrived && hazardArrival(s.arrivedAt))) audio().playSting('danger');
    else if (entries.some((e) => ALARM_KINDS.has(e.kind))) audio().sfx('alarm');
    else if (entries.some((e) => !QUIET_KINDS.has(e.kind))) audio().sfx('event.ding');
    if (shown.length > 0) {
      this.setBusy(false);
      this.modal(shown.map((e) => e.text).join('\n\n'), { onClose: next });
    } else next();
  }

  /** One memorial beacon prompt per crew death this action (the run continues), then `done`. */
  private beaconsThen(dead: string[], done: () => void): void {
    const [name, ...rest] = dead;
    if (name === undefined) return done();
    const slot = session.state!.crew.findIndex((c) => c.name === name);
    promptBeacon(this, this.router, name, (text) => {
      if (text) saveBeacon(makeBeacon(session.state!, name, text));
      this.beaconsThen(rest, done);
    }, slot >= 0 ? `portrait.${slot + 1}` : undefined);
  }
}
