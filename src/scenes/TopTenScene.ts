/** The Top Ten (scoring.md "High scores"): stored rows merged with the writer's defaults; Esc/Enter back to Title. */
import { readHighScores } from '@/game/saveStore';
import { t } from '@/ui/copy';
import { isBack, isConfirm } from '@/ui/keys';
import { addText } from '@/ui/text';
import { COLORS } from '@/ui/theme';
import { BaseScene } from './BaseScene';
import { topTenLines } from './topTenView';

const LEFT = 128;
const TOP = 76;
const ROW_H = 24;

export class TopTenScene extends BaseScene {
  constructor() {
    super('TopTen');
  }

  protected override music(): string {
    return 'title';
  }

  /** `highlight`: row index of the run just entered (drawn bright with a marker). */
  create(data?: { highlight?: number }): void {
    this.begin();
    this.heading(24, t('topTen.title').toUpperCase());
    addText(this, LEFT, TOP - ROW_H, t('topTen.header'), { color: COLORS.dim });
    const lines = topTenLines(readHighScores());
    if (lines.length === 0) addText(this, LEFT, TOP, t('topTen.empty'), { color: COLORS.text });
    lines.forEach((line, i) => {
      const mine = i === data?.highlight;
      addText(this, mine ? LEFT - 16 : LEFT, TOP + i * ROW_H, mine ? `> ${line}` : line, { color: mine ? COLORS.bright : COLORS.text });
    });
    addText(this, LEFT, 372, t('common.back'), { color: COLORS.dim });
    this.router.set({
      onKey: (e) => {
        if (isBack(e) || isConfirm(e)) this.go('Title');
      },
    });
    this.input.once('pointerdown', () => this.go('Title'));
  }
}
