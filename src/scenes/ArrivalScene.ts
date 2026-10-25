/**
 * Arrival at New Willamette: intro, then the score breakdown from computeScore and the rating line. A score that
 * `qualifies` for the Top Ten asks for a name (default: the captain), inserts it and shows `topTen.yourRun`.
 */
import { DIFFICULTIES, NAME_MAX_LENGTH } from '@/content';
import { readHighScores, writeHighScores } from '@/game/saveStore';
import { session } from '@/game/session';
import { computeScore, insertHighScore, qualifies, type ScoreBreakdown } from '@/sim';
import { list, t } from '@/ui/copy';
import { NameInput } from '@/ui/NameInput';
import { Menu } from '@/ui/Menu';
import { Table } from '@/ui/Table';
import { TextBox } from '@/ui/TextBox';
import { audio } from '@/audio/AudioManager';
import { addSprite } from '@/gfx/travelArt';
import { addText } from '@/ui/text';
import { COLORS, fmt } from '@/ui/theme';
import { BaseScene } from './BaseScene';

export class ArrivalScene extends BaseScene {
  constructor() {
    super('Arrival');
  }

  protected override music(): string {
    return 'fanfare';
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
    audio().sfx('arrival.bell');
    addSprite(this, 540, 70, 'landmark.proxima', session.settings.reducedMotion);
    this.heading(40, t('arrival.title').toUpperCase(), 2);
    // The crew as they arrive: healthy, sick or dead portraits in slot order.
    session.state!.crew.forEach((c, i) => {
      const frame = !c.alive ? 2 : c.conditions.length > 0 ? 1 : 0;
      this.add.image(60 + i * 40, 230, `portrait.${i + 1}`, frame).setOrigin(0, 0);
    });
    new TextBox(this, 60, 110, 420, t('arrival.intro'), { typewriter: true });
    const menu = new Menu(this, [{ label: t('arrival.continue') }], { x: 60, y: 300, onSelect: () => this.score() });
    this.router.set(menu);
  }

  private score(): void {
    this.clear();
    const sc = computeScore(session.state!);
    this.heading(14, t('score.title'));
    const rows: (readonly string[])[] = sc.lines.filter((l) => !(l.points === 0 && (l.key === 'flareBonus' || l.key === 'noDeathsBonus' || l.key === 'rodeTheWind'))).map((l) => [t(`score.labels.${l.key}`), fmt(l.points)]);
    rows.push(['', ''], [t('score.subtotal'), fmt(sc.subtotal)], [t('score.multiplier'), `x${sc.multiplier}`]);
    const d = sc.difficulty.points;
    if (d !== 0) rows.push([t('score.labels.difficulty', { name: DIFFICULTIES[session.state!.difficulty].name }), `${d > 0 ? '+' : '-'}${fmt(Math.abs(d))}`]);
    const table = new Table(this, 150, 44, [{ width: 26 }, { width: 8, right: true }], 16);
    table.setRows(rows);
    addText(this, 150, table.bottom + 4, table.format([t('score.total'), fmt(sc.total)]), { color: COLORS.bright });
    const ratingTitle = t(`arrival.ratings.${sc.rating}.title`);
    addText(this, 150, table.bottom + 24, t('score.rating', { rating: ratingTitle }), { color: COLORS.bright });
    new TextBox(this, 40, table.bottom + 50, 560, t(`arrival.ratings.${sc.rating}.line`), { color: COLORS.text });
    const s = session.state!;
    const entering = qualifies(readHighScores(), sc.total, s.date);
    const items = entering ? [{ label: t('arrival.continue') }] : [{ label: t('arrival.returnTitle') }];
    const menu = new Menu(this, items, { x: 40, y: 372, onSelect: () => (entering ? this.topTen(sc) : this.go('Title')) });
    this.router.set(menu);
  }

  /** Top Ten entry: name prompt (default captain), insert + save, then "Your run" and Top Ten / Title. */
  private topTen(sc: ScoreBreakdown): void {
    this.clear();
    const s = session.state!;
    const captain = s.crew[0]?.name ?? '';
    this.heading(40, t('topTen.title').toUpperCase());
    new TextBox(this, 60, 100, 520, t('topTen.enterPrompt'));
    addText(this, 60, 140, t('topTen.enterHint'), { color: COLORS.dim });
    const input = new NameInput(this, 60, 170, {
      placeholder: captain,
      maxLength: NAME_MAX_LENGTH,
      onCommit: (name) => {
        input.destroy();
        const { list: rows, index } = insertHighScore(readHighScores(), {
          name: name || captain, profession: s.profession, score: sc.total, days: s.day, date: s.date, difficulty: s.difficulty,
        });
        if (index >= 0) writeHighScores(rows);
        addText(this, 60, 170, name || captain, { color: COLORS.bright });
        const rating = t(`arrival.ratings.${sc.rating}.title`);
        new TextBox(this, 60, 210, 520, t('topTen.yourRun', { rating, n: fmt(sc.total) }), { color: COLORS.bright });
        const menu = new Menu(this, [{ label: list('title.menu')[2] ?? '' }, { label: t('arrival.returnTitle') }], {
          x: 60, y: 300, onSelect: (i) => (i === 0 ? this.scene.start('TopTen', { highlight: index }) : this.go('Title')),
        });
        this.router.set(menu);
      },
    });
    this.router.set(input);
  }
}
