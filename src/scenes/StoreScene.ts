/** Mattie's Outfitters: pick quantities, watch the total, heed (or not) the advice, leave and launch. */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { ITEM_ORDER, ITEMS, type SupplyKey } from '@/content';
import { session } from '@/game/session';
import { buy, costOf, createRng, depart, maxBuyable, priceAt, storeWarnings, type GameState } from '@/sim';
import { list, t } from '@/ui/copy';
import { Menu, type MenuItem } from '@/ui/Menu';
import { NumberInput } from '@/ui/NumberInput';
import { TextBox } from '@/ui/TextBox';
import { addText } from '@/ui/text';
import { CHAR_W, col, COLORS, money } from '@/ui/theme';
import { BaseScene } from './BaseScene';

const LEFT = 24;
const MENU_Y = 122;
const ROW_H = 20;
const NAME_W = 25;

type Basket = Record<SupplyKey, number>;

export class StoreScene extends BaseScene {
  private base!: GameState;
  private basket!: Basket;
  private menu!: Menu;
  private mattie!: TextBox;
  private totals!: Phaser.GameObjects.BitmapText;
  private warnings!: Phaser.GameObjects.BitmapText;
  private advice!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Store');
  }

  protected override music(): string {
    return 'station';
  }

  create(): void {
    this.begin();
    if (!session.state) return this.go('Title');
    this.base = session.state;
    this.basket = { drives: 0, rations: 0, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0 };
    this.heading(10, t('store.title'));
    this.mattie = new TextBox(this, LEFT, 34, 592, t('mattie.greeting'), { typewriter: true });
    addText(this, LEFT, MENU_Y - ROW_H, `     ${t('store.header')}`, { color: COLORS.dim });
    this.menu = new Menu(this, this.rows(), {
      x: LEFT,
      y: MENU_Y,
      numbered: true,
      lineHeight: ROW_H,
      onMove: (i) => this.describe(i),
      onSelect: (i) => (i < ITEM_ORDER.length ? this.editQuantity(ITEM_ORDER[i]!) : this.leave()),
      onBack: () => this.go('Setup'),
    });
    this.totals = addText(this, LEFT, MENU_Y + 8 * ROW_H + 10, '', { color: COLORS.bright });
    this.warnings = addText(this, LEFT, MENU_Y + 8 * ROW_H + 32, '', { color: COLORS.warn, wrap: 592 });
    this.advice = addText(this, LEFT, 362, '', { color: COLORS.dim, wrap: 592 });
    this.router.push(this.menu);
    this.refresh();
  }

  /** The base state with every basket line bought (pure; buy never mutates). */
  private preview(basket: Basket = this.basket): GameState {
    return ITEM_ORDER.reduce((s, id) => (basket[id] > 0 ? buy(s, id, basket[id]).state : s), this.base);
  }

  private total(): number {
    return ITEM_ORDER.reduce((sum, id) => sum + this.cost(id, this.basket[id]), 0);
  }

  /** Basket line cost at Independence on this run's difficulty (the same price `buy` charges). */
  private cost(id: SupplyKey, packs: number): number {
    return costOf(id, packs, 0, this.base.difficulty);
  }

  private rows(): MenuItem[] {
    const items = ITEM_ORDER.map((id) => {
      const def = ITEMS[id];
      const name = def.packSize > 1 ? `${def.name} (${t('store.perBox', { n: def.packSize })})` : def.name;
      const qty = this.basket[id];
      return { label: [col(name, NAME_W), col(`${money(priceAt(id, 0, this.base.difficulty))} cr`, 8, true), col(String(qty), 6, true), col(`${money(this.cost(id, qty))} cr`, 11, true)].join(' ') };
    });
    return [...items, { label: t('store.leave') }];
  }

  private describe(i: number): void {
    const id = ITEM_ORDER[i];
    this.mattie.set(id ? t(`mattie.items.${id}`) : t('mattie.confirmPrompt'));
  }

  private currentWarnings(state: GameState): string[] {
    return storeWarnings(state).map((k) => t(`mattie.warnings.${k}`));
  }

  private refresh(): void {
    const p = this.preview();
    session.state = p;
    this.menu.setItems(this.rows());
    this.totals.setText(t('store.total', { total: money(this.total()), left: money(p.credits) }));
    const warnings = this.currentWarnings(p);
    this.warnings.setText(warnings.join('\n'));
    // Advice fills the footer only when Mattie has no warnings to give.
    this.advice.setText(warnings.length ? '' : session.uiRng.pick(list('mattie.advice')));
  }

  private editQuantity(id: SupplyKey): void {
    const others: Basket = { ...this.basket, [id]: 0 };
    const max = maxBuyable(this.preview(others), id);
    const before = this.basket[id];
    this.mattie.set(`${t(`mattie.items.${id}`)}\n${t('store.qtyPrompt', { n: max })}`);
    const row = ITEM_ORDER.indexOf(id);
    // Overlay the quantity column of this row.
    const x = LEFT + (5 + NAME_W + 1 + 8 + 1 - 3) * CHAR_W;
    const cover = this.add.rectangle(x - 2, MENU_Y + row * ROW_H, 9 * CHAR_W + 8, ROW_H - 2, COLORS.bg).setOrigin(0, 0);
    const done = (value: number): void => {
      if (value !== before) audio().sfx(value > before ? 'store.buy' : 'store.sell');
      this.basket[id] = value;
      input.destroy();
      cover.destroy();
      this.router.remove(input);
      this.refresh();
      this.describe(row);
    };
    const input: NumberInput = new NumberInput(this, x, MENU_Y + row * ROW_H, {
      min: 0,
      max,
      value: before,
      onChange: (v) => this.totals.setText(t('store.total', { total: money(this.total() - this.cost(id, before) + this.cost(id, v)), left: money(this.preview({ ...others, [id]: v }).credits) })),
      onCommit: done,
      onCancel: () => done(before),
    });
    this.router.push(input);
  }

  private leave(): void {
    const p = this.preview();
    // Probe the depart rule with a throwaway rng so a refused or cancelled launch never draws from the run rng.
    if (depart(p, createRng(0)).error) {
      this.modal(t('mattie.warnings.noDrives'));
      return;
    }
    const warn = this.currentWarnings(p);
    const msg = [t('mattie.confirm', { n: money(this.total()) }), ...warn, t('mattie.confirmPrompt')].join('\n\n');
    this.modal(msg, {
      buttons: [t('common.yes'), t('common.no')],
      onClose: (i) => {
        if (i !== 0) return;
        session.state = depart(p, session.rng).state;
        this.modal(t('mattie.thanks'), { onClose: () => this.go('Travel') });
      },
    });
  }
}
