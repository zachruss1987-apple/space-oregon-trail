/** New run setup: profession → five crew names → launch window. Esc steps back. */
import { CREW_SIZE, NAME_MAX_LENGTH, PROFESSION_ORDER, PROFESSIONS, WINDOW_ORDER, WINDOWS } from '@/content';
import { session } from '@/game/session';
import { createGame, randomCrewNames } from '@/sim';
import { list, t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { NameInput } from '@/ui/NameInput';
import { TextBox } from '@/ui/TextBox';
import { addText } from '@/ui/text';
import { COLORS, fmt, LINE_HEIGHT } from '@/ui/theme';
import { BaseScene } from './BaseScene';

const LEFT = 40;
const WIDTH = 560;

export class SetupScene extends BaseScene {
  constructor() {
    super('Setup');
  }

  protected override music(): string {
    return 'title';
  }

  create(): void {
    this.begin();
    this.professionStep();
  }

  /** Wipe the current sub-step. */
  private clear(): void {
    this.time.removeAllEvents();
    this.children.removeAll(true);
  }

  private professionStep(): void {
    this.clear();
    new TextBox(this, LEFT, 30, WIDTH, t('setup.professionPrompt'), { typewriter: true });
    const blurb = new TextBox(this, LEFT, 220, WIDTH, '', { color: COLORS.dim });
    const describe = (i: number): void => {
      const p = PROFESSIONS[PROFESSION_ORDER[i]!];
      blurb.set(t(`setup.professions.${p.name}`));
    };
    const start = PROFESSION_ORDER.indexOf(session.draft.profession);
    const menu = new Menu(this, PROFESSION_ORDER.map((id) => {
      const p = PROFESSIONS[id];
      return { label: `${p.name.padEnd(22)} ${t('setup.credits', { n: fmt(p.credits) })}` };
    }), {
      x: LEFT,
      y: 100,
      numbered: true,
      lineHeight: 24,
      cursor: start,
      onMove: describe,
      onSelect: (i) => {
        session.draft.profession = PROFESSION_ORDER[i]!;
        this.nameStep(0);
      },
      onBack: () => this.go('Title'),
    });
    describe(menu.cursor);
    this.hint();
    this.router.set(menu);
  }

  private nameStep(field: number): void {
    this.clear();
    const names = session.draft.names;
    new TextBox(this, LEFT, 30, WIDTH, t('setup.namePrompt'));
    addText(this, LEFT, 70, t('setup.nameHint'), { color: COLORS.dim, wrap: WIDTH });
    const label = (i: number): string => (i === 0 ? t('setup.captain') : t('setup.crew', { n: i + 1 }));
    const rowY = (i: number): number => 120 + i * (LINE_HEIGHT + 8);
    for (let i = 0; i < CREW_SIZE; i++) {
      const color = i === field ? COLORS.bright : COLORS.text;
      addText(this, LEFT, rowY(i), `${i === field ? '>' : ' '} ${label(i).padEnd(10)}`, { color });
      if (i !== field) addText(this, LEFT + 120, rowY(i), names[i] ?? '', { color: COLORS.text });
    }
    addText(this, LEFT, rowY(CREW_SIZE) + 10, t('setup.randomHint', { label: t('setup.randomNames') }), { color: COLORS.dim });
    const input = new NameInput(this, LEFT + 120, rowY(field), {
      placeholder: names[field] ?? '',
      maxLength: NAME_MAX_LENGTH,
      onCommit: (value) => {
        names[field] = value;
        if (field + 1 < CREW_SIZE) this.nameStep(field + 1);
        else this.windowStep();
      },
      onCancel: () => (field === 0 ? this.professionStep() : this.nameStep(field - 1)),
      onOtherKey: (e) => {
        if (e.key !== 'Tab') return false;
        session.draft.names = randomCrewNames(session.uiRng);
        this.nameStep(field);
        return true;
      },
    });
    this.hint();
    this.router.set(input);
  }

  private windowStep(): void {
    this.clear();
    new TextBox(this, LEFT, 30, WIDTH, t('setup.windowPrompt'), { typewriter: true });
    const blurbs = list('setup.windows');
    const blurb = new TextBox(this, LEFT, 250, WIDTH, '', { color: COLORS.dim });
    const menu = new Menu(this, WINDOW_ORDER.map((id) => ({ label: WINDOWS[id].label })), {
      x: LEFT,
      y: 90,
      numbered: true,
      lineHeight: 24,
      cursor: WINDOW_ORDER.indexOf(session.draft.window),
      onMove: (i) => blurb.set(blurbs[i] ?? ''),
      onSelect: (i) => {
        session.draft.window = WINDOW_ORDER[i]!;
        this.startRun();
      },
      onBack: () => this.nameStep(CREW_SIZE - 1),
    });
    blurb.set(blurbs[menu.cursor] ?? '');
    this.hint();
    this.router.set(menu);
  }

  private startRun(): void {
    const { profession, names, window } = session.draft;
    session.state = createGame({ profession, crewNames: names, window, seed: session.seedLabel }, session.rng);
    this.go('Store');
  }

  private hint(): void {
    addText(this, LEFT, 372, t('common.back'), { color: COLORS.dim });
  }
}
