/**
 * The key hints band (keyhints.md): a per-scene component that BaseScene.begin() creates after fitCamera. It draws
 * the 16 px strip at y 400..415 inside the scene's own camera (which shows 416 rows), so the CRT stays one post pass
 * per frame. It listens to the set id the KeyRouter publishes (keyHints.ts) until the scene shuts down, lays it out
 * with `fitHints` and mirrors the shown id in `body[data-hints]` (absent while the option hides it). On the `touch`
 * platform the same set becomes tappable keys (keyhints.md "Touch platform"): each dispatches its KeyboardEvent on window.
 */
import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, hintBarH } from '@/config';
import { session } from '@/game/session';
import { list, t } from './copy';
import {
  currentHints, detectPlatform, fitHints, fitTouchButtons, hintMode, hintsShown, onHints, parseHint, parseHintSet, touchButtons,
  type HintState, type PlacedButton, type PlacedHint, type Platform,
} from './keyHints';
import { addText } from './text';
import { CHAR_W, COLORS } from './theme';

/** Above everything a scene draws (modal blockers 100, help overlay 200). */
export const HINT_BAND_DEPTH = 500;
/** Text row inside the band (8 px glyphs, rule on row 400). */
const TEXT_Y = GAME_HEIGHT + 4;

/** The browser's platform (navigator / matchMedia), with the `?platform=` override. */
export function browserPlatform(): Platform {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return detectPlatform({ userAgent: nav.userAgent ?? '', uaPlatform: nav.userAgentData?.platform ?? '', coarsePointer: coarse }, window.location.search);
}

export class KeyHintsBand {
  private readonly platform = browserPlatform();
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    document.body.dataset['platform'] = this.platform;
    document.body.dataset['hintmode'] = hintMode(this.platform);
    const off = onHints((s) => this.paint(s));
    scene.events.once('shutdown', () => {
      off();
      this.objects = [];
    });
    this.paint(currentHints());
  }

  private paint(s: HintState): void {
    this.objects.forEach((o) => o.destroy());
    const d = HINT_BAND_DEPTH;
    this.objects = [
      this.scene.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, hintBarH(), COLORS.bg).setOrigin(0, 0).setDepth(d),
      this.scene.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, 1, COLORS.borderDim).setOrigin(0, 0).setDepth(d),
    ];
    if (!hintsShown(session.options.keyHints)) {
      delete document.body.dataset['hints'];
      return;
    }
    document.body.dataset['hints'] = s.id;
    const set = parseHintSet(list(`hints.${s.id}`));
    // `[?] Help` sits at the right except while typing, on an empty bar, or with the overlay itself open.
    const help = s.textEntry || s.id === 'none' || s.id === 'help' ? null : parseHint(t('hints.helpKey'));
    if (this.platform === 'touch') {
      const fit = fitTouchButtons(touchButtons(set, s.id), help ? touchButtons([help])[0] ?? null : null);
      for (const b of [...fit.left, ...(fit.help ? [fit.help] : [])]) this.button(b);
      return;
    }
    const fit = fitHints(set, help, this.platform);
    for (const g of [...fit.left, ...(fit.help ? [fit.help] : [])]) this.group(g);
  }

  /** A tappable key: 20 px tall, panel fill, dim frame, bright label; a tap sends its keydown + keyup to window. */
  private button(b: PlacedButton): void {
    const y = GAME_HEIGHT + 2;
    const box = this.scene.add.rectangle(b.x, y, b.w, 20, COLORS.panel).setOrigin(0, 0).setStrokeStyle(1, COLORS.borderDim).setDepth(HINT_BAND_DEPTH);
    box.setInteractive({ useHandCursor: true });
    // Next task: the key may repaint this band (or end the scene) and must not destroy the button inside its own event.
    box.on('pointerdown', () => setTimeout(() => pressKey(b.key, b.code), 0));
    this.objects.push(box, addText(this.scene, b.x + CHAR_W, y + 6, b.label, { color: COLORS.bright, depth: HINT_BAND_DEPTH }));
  }

  private group(g: PlacedHint): void {
    const key = `[${g.key}]`;
    this.objects.push(
      addText(this.scene, g.x, TEXT_Y, key, { color: COLORS.bright, depth: HINT_BAND_DEPTH }),
      addText(this.scene, g.x + (key.length + 1) * CHAR_W, TEXT_Y, g.label, { color: COLORS.dim, depth: HINT_BAND_DEPTH }),
    );
  }
}

/** Send a key to the game exactly as a keyboard would (KeyRouter listens on window). */
function pressKey(key: string, code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true }));
}
