/**
 * A road station (economy.md "Enter station flow"), available while `stationOpen(state)`: Outfitters (buy/sell at
 * local prices), Trade (NPC offers), Talk, Rest here, Continue (route prompt at Titan Refinery, then depart).
 */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { ITEM_ORDER, ITEMS, REST, WAYPOINTS, type SupplyKey } from '@/content';
import { session } from '@/game/session';
import {
  applyAction, intentBlocker, maxBuyable, maxSellable, shuffledTalk, stationGreeting, stationKeeper, stationOpen,
  tradeLine, type Intent, type LogEntry, type TradeOffer,
} from '@/sim';
import { list, t } from '@/ui/copy';
import { DayLog } from '@/ui/DayLog';
import { Menu, type MenuItem } from '@/ui/Menu';
import { promptNumber } from '@/ui/NumberPrompt';
import { TextBox } from '@/ui/TextBox';
import { panel } from '@/ui/chrome';
import { addText } from '@/ui/text';
import { COLORS, money } from '@/ui/theme';
import { artBand } from './artBand';
import { BaseScene } from './BaseScene';
import { buyReason, outfitterHeader, outfitterRows, sellReason, tradeRows, tradeTerms } from './stationView';
import { MODAL_KINDS } from './travelView';

const MENU_Y = 166;
const MENU_LH = 18;
type Mode = 'main' | 'outfitters' | 'trade';

export class StationScene extends BaseScene {
  private wp = 0;
  private mode: Mode = 'main';
  private menu!: Menu;
  private speech!: TextBox;
  private header!: Phaser.GameObjects.BitmapText;
  private credits!: Phaser.GameObjects.BitmapText;
  private log!: DayLog;
  private talk: string[] = [];
  private talkAt = 0;
  private pitches = new Map<number, string>();

  constructor() {
    super('Station');
  }

  protected override music(): string {
    return 'station';
  }

  create(): void {
    this.begin();
    const s = session.state;
    if (!s) return this.go('Title');
    if (!stationOpen(s)) return this.go('Travel');
    this.wp = s.arrivedAt!;
    this.talk = [];
    this.talkAt = 0;
    this.pitches = new Map();
    const w = WAYPOINTS[this.wp]!;
    // The station's exterior in the top band (art.md "Stations"), name and keeper beside it.
    artBand(this, this.wp, { h: 72, artX: 572, title: w.name.toUpperCase(), sub: stationKeeper(w.id) ?? t('station.title') });
    this.credits = addText(this, 12, 50, '', { color: COLORS.text });
    this.speech = new TextBox(this, 24, 82, 592, stationGreeting(session.uiRng, s, this.wp), { typewriter: true });
    this.header = addText(this, 16, MENU_Y - 16, '', { color: COLORS.dim });
    this.menu = new Menu(this, [], {
      x: 16, y: MENU_Y, numbered: true, lineHeight: MENU_LH,
      onSelect: (i) => this.select(i), onMove: (i) => this.moved(i), onBack: () => this.setMode('main'),
    });
    panel(this, 0, 336, 640, 64);
    this.log = new DayLog(this, 14, 346, 612, 3);
    this.router.push({
      hints: () => this.menu.hintSet,
      onKey: (e) => {
        if (this.log.busy) return;
        if (this.speech.typing) this.speech.finish();
        this.menu.onKey(e);
      },
    });
    this.mode = 'main';
    this.refresh();
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.refresh();
    this.menu.setCursor(0);
    this.moved(0);
  }

  private offers(): TradeOffer[] {
    return session.state!.station?.offers ?? [];
  }

  private refresh(): void {
    const s = session.state!;
    this.credits.setText(t('station.creditsLine', { n: money(s.credits) }));
    let items: MenuItem[];
    if (this.mode === 'outfitters') items = [...outfitterRows(s, this.wp), { label: t('station.outfitters.back') }];
    else if (this.mode === 'trade') items = [...tradeRows(this.offers()), { label: t('station.trade.back') }];
    else items = list('station.menu').map((label) => ({ label }));
    this.header.setText(this.mode === 'outfitters' ? `     ${outfitterHeader()}` : '');
    this.menu.setItems(items);
  }

  /** Cursor moved: describe the item, or show the trader's pitch. */
  private moved(i: number): void {
    if (this.mode === 'outfitters') {
      const id = ITEM_ORDER[i];
      const def = id ? ITEMS[id] : undefined;
      this.speech.set(def ? (def.packSize > 1 ? `${def.name} ${t('station.outfitters.perBox', { n: def.packSize })}` : def.name) : '');
    } else if (this.mode === 'trade') {
      const offer = this.offers()[i];
      if (this.offers().length === 0) this.speech.set(t('station.trade.nobody'));
      else if (offer) this.speech.set(this.pitch(i, offer));
    } else this.speech.set(t('station.menuHint'));
  }

  private pitch(i: number, offer: TradeOffer): string {
    if (!this.pitches.has(i)) this.pitches.set(i, tradeLine(session.uiRng, offer, 'offer'));
    return this.pitches.get(i)!;
  }

  private select(i: number): void {
    if (this.mode === 'outfitters') {
      const id = ITEM_ORDER[i];
      return id ? this.outfit(id) : this.setMode('main');
    }
    if (this.mode === 'trade') {
      const offer = this.offers()[i];
      return offer ? this.trade(i, offer) : this.setMode('main');
    }
    switch (i) {
      case 0: return this.setMode('outfitters');
      case 1: return this.setMode('trade');
      case 2: return this.nextTalk();
      case 3:
        return promptNumber(this, this.router, t('station.rest.prompt'), { min: REST.minDays, max: REST.maxDays }, (days) => {
          if (days !== null) this.dispatch({ type: 'rest', days });
        });
      default: return this.leave();
    }
  }

  /** Buy / Sell / Back for one item, then a quantity prompt. */
  private outfit(id: SupplyKey): void {
    const s = session.state!;
    this.modal(ITEMS[id].name, {
      buttons: [
        { label: t('station.outfitters.buy'), disabled: buyReason(s, id, this.wp) },
        { label: t('station.outfitters.sell'), disabled: sellReason(s, id, this.wp) },
        t('station.outfitters.back'),
      ],
      onClose: (b) => {
        if (b > 1) return;
        const max = b === 0 ? maxBuyable(session.state!, id) : maxSellable(session.state!, id);
        const prompt = t(b === 0 ? 'station.outfitters.buyPrompt' : 'station.outfitters.sellPrompt', { n: max });
        promptNumber(this, this.router, prompt, { min: 1, max }, (packs) => {
          if (packs !== null) this.dispatch(b === 0 ? { type: 'buy', item: id, packs } : { type: 'sell', item: id, packs });
        });
      },
    });
  }

  private trade(i: number, offer: TradeOffer): void {
    this.modal(`${this.pitch(i, offer)}\n\n${tradeTerms(offer)}`, {
      buttons: [t('station.trade.accept'), t('station.trade.decline')],
      onClose: (b) => {
        if (b === 0) this.dispatch({ type: 'trade', offer: i });
        else this.speech.set(tradeLine(session.uiRng, offer, 'decline'));
      },
    });
  }

  private nextTalk(): void {
    if (this.talkAt >= this.talk.length) {
      this.talk = shuffledTalk(WAYPOINTS[this.wp]!.id, session.uiRng);
      this.talkAt = 0;
    }
    this.speech.set(this.talk[this.talkAt++] ?? t('station.talk.empty'));
  }

  /** Continue: the sim's refusal (no drive), else the route prompt at Titan, then Travel runs the departing day. */
  private leave(): void {
    const why = intentBlocker(session.state!, { type: 'continue' });
    if (why) {
      this.speech.set(why);
      return this.menu.say(why);
    }
    this.askRoute((chosen) => {
      if (!chosen) return;
      session.departOnTravel = true;
      this.go('Travel');
    });
  }

  private dispatch(intent: Intent): void {
    const r = applyAction(session.state!, intent, session.rng);
    if (r.error) {
      this.speech.set(r.error);
      return this.menu.say(r.error);
    }
    session.state = r.state;
    if (intent.type === 'buy') audio().sfx('store.buy');
    else if (intent.type === 'sell') audio().sfx('store.sell');
    else if (intent.type === 'trade') audio().sfx('trade.accept');
    if (intent.type === 'trade') this.speech.set(r.entries.map((e) => e.text).join(' '));
    this.log.play(r.entries, () => this.after(r.entries));
  }

  private after(entries: LogEntry[]): void {
    const s = session.state!;
    const next = (): void => {
      if (s.status !== 'traveling') this.ending();
      else if (!stationOpen(s)) this.go('Travel');
      else this.refresh();
    };
    const shown = entries.filter((e) => MODAL_KINDS.has(e.kind)).map((e) => e.text);
    if (shown.length > 0) this.modal(shown.join('\n\n'), { onClose: next });
    else next();
  }
}
