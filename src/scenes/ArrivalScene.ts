/** Arrival at New Willamette: intro, then the score breakdown from computeScore and the rating line. */
import { session } from '@/game/session';
import { computeScore } from '@/sim';
import { t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { Table } from '@/ui/Table';
import { TextBox } from '@/ui/TextBox';
import { COLORS, fmt, textStyle } from '@/ui/theme';
import { BaseScene } from './BaseScene';

export class ArrivalScene extends BaseScene {
  constructor() {
    super('Arrival');
  }

  create(): void {
    this.begin();
    if (!session.state) return this.go('Title');
    this.intro();
  }

  private clear(): void {
    this.time.removeAllEvents();
    this.children.removeAll(true);
  }

  private intro(): void {
    this.heading(40, t('arrival.title').toUpperCase(), 24);
    new TextBox(this, 60, 110, 520, t('arrival.intro'), { typewriter: true });
    const menu = new Menu(this, [{ label: t('arrival.continue') }], { x: 60, y: 300, onSelect: () => this.score() });
    this.router.set(menu);
  }

  private score(): void {
    this.clear();
    const sc = computeScore(session.state!);
    this.heading(14, t('score.title'), 16);
    const rows: (readonly string[])[] = sc.lines.filter((l) => !(l.points === 0 && (l.key === 'flareBonus' || l.key === 'noDeathsBonus' || l.key === 'rodeTheWind'))).map((l) => [t(`score.labels.${l.key}`), fmt(l.points)]);
    rows.push(['', ''], [t('score.subtotal'), fmt(sc.subtotal)], [t('score.multiplier'), `x${sc.multiplier}`]);
    const table = new Table(this, 150, 44, [{ width: 26 }, { width: 8, right: true }], 18);
    table.setRows(rows);
    this.add.text(150, table.bottom + 4, table.format([t('score.total'), fmt(sc.total)]), textStyle(COLORS.bright));
    const ratingTitle = t(`arrival.ratings.${sc.rating}.title`);
    this.add.text(150, table.bottom + 28, t('score.rating', { rating: ratingTitle }), textStyle(COLORS.bright));
    new TextBox(this, 40, table.bottom + 50, 560, t(`arrival.ratings.${sc.rating}.line`), { color: COLORS.text });
    const menu = new Menu(this, [{ label: t('arrival.returnTitle') }], { x: 40, y: 372, onSelect: () => this.go('Title') });
    this.router.set(menu);
  }
}
