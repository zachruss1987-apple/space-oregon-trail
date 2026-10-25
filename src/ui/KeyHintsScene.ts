/**
 * The key hints band (keyhints.md): a persistent scene, launched by Boot once fonts exist and never stopped, that draws
 * the 16 px strip at y 400..415 under every scene. It listens to the set id the KeyRouter publishes (keyHints.ts),
 * lays it out with `fitHints` and mirrors the shown id in `body[data-hints]` (absent while hidden by the option or
 * platform). It never sets `data-scene` and takes no input.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HINT_BAR_H } from '@/config';
import { session } from '@/game/session';
import { fitCamera } from '@/gfx/view';
import { list, t } from './copy';
import {
  currentHints, detectPlatform, fitHints, hintsShown, onHints, parseHint, parseHintSet, type HintState, type PlacedHint, type Platform,
} from './keyHints';
import { addText } from './text';
import { CHAR_W, COLORS } from './theme';

export const KEY_HINTS_SCENE = 'KeyHints';
/** Text row inside the band (8 px glyphs, rule on row 400). */
const TEXT_Y = GAME_HEIGHT + 4;

/** The browser's platform (navigator / matchMedia), with the `?platform=` override. */
export function browserPlatform(): Platform {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return detectPlatform({ userAgent: nav.userAgent ?? '', uaPlatform: nav.userAgentData?.platform ?? '', coarsePointer: coarse }, window.location.search);
}

export class KeyHintsScene extends Phaser.Scene {
  private platform: Platform = 'linux';
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: KEY_HINTS_SCENE });
  }

  create(): void {
    fitCamera(this);
    this.platform = browserPlatform();
    document.body.dataset['platform'] = this.platform;
    const off = onHints((s) => this.paint(s));
    this.events.once('shutdown', () => {
      off();
      delete document.body.dataset['hints'];
    });
    this.paint(currentHints());
  }

  private paint(s: HintState): void {
    this.objects.forEach((o) => o.destroy());
    this.objects = [
      this.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, HINT_BAR_H, COLORS.bg).setOrigin(0, 0),
      this.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, 1, COLORS.borderDim).setOrigin(0, 0),
    ];
    if (!hintsShown(session.options.keyHints, this.platform)) {
      delete document.body.dataset['hints'];
      return;
    }
    document.body.dataset['hints'] = s.id;
    const set = parseHintSet(list(`hints.${s.id}`));
    // `[?] Help` sits at the right except while typing, on an empty bar, or with the overlay itself open.
    const help = s.textEntry || s.id === 'none' || s.id === 'help' ? null : parseHint(t('hints.helpKey'));
    const fit = fitHints(set, help, this.platform);
    for (const g of [...fit.left, ...(fit.help ? [fit.help] : [])]) this.group(g);
  }

  private group(g: PlacedHint): void {
    const key = `[${g.key}]`;
    this.objects.push(
      addText(this, g.x, TEXT_Y, key, { color: COLORS.bright }),
      addText(this, g.x + (key.length + 1) * CHAR_W, TEXT_Y, g.label, { color: COLORS.dim }),
    );
  }
}
