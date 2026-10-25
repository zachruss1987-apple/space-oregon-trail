/** Shared scene plumbing: e2e marker, key router, modal helper, heading text, endings, the Titan route prompt. */
import Phaser from 'phaser';
import { GAME_WIDTH } from '@/config';
import { ROUTE } from '@/content';
import { markScene } from '@/game/contract';
import { session } from '@/game/session';
import { applyAction, cumulativeAt, type RouteId } from '@/sim';
import { t } from '@/ui/copy';
import { KeyRouter } from '@/ui/keys';
import { Modal, resetModals, type ModalOptions } from '@/ui/Modal';
import { audio } from '@/audio/AudioManager';
import { fitCamera } from '@/gfx/view';
import { addText } from '@/ui/text';
import { CHAR_W, COLORS, fmt } from '@/ui/theme';

/** Scene keys (the `data-scene` values). */
export type SceneKey =
  | 'Title' | 'Setup' | 'Store' | 'Travel' | 'Supplies' | 'Map' | 'Waypoint' | 'Hazard' | 'Station' | 'Death' | 'Arrival'
  | 'Salvage' | 'Threading' | 'Flare' | 'Options' | 'TopTen' | 'Guide';

/** Mk from the Kuiper Gate (branch + 1) to the Heliopause on a route, for the route prompt. */
function gateToHeliopause(route: RouteId): number {
  return cumulativeAt(ROUTE.skipped + 1, route) - cumulativeAt(ROUTE.skipAfter, route);
}

export abstract class BaseScene extends Phaser.Scene {
  protected router!: KeyRouter;

  constructor(readonly sceneKey: SceneKey) {
    super({ key: sceneKey });
  }

  /** Song for this scene (audio.md "Songs"), or null to keep whatever plays. Same id = no restart. */
  protected music(): string | null {
    return null;
  }

  /** Call first in create(). */
  protected begin(): void {
    resetModals();
    this.router = new KeyRouter(this);
    fitCamera(this).setBackgroundColor(COLORS.bg);
    markScene(this.sceneKey);
    const song = this.music();
    if (song) audio().playMusic(song);
  }

  protected modal(message: string, opts?: ModalOptions): Modal {
    return new Modal(this, this.router, message, opts);
  }

  protected go(key: SceneKey): void {
    this.scene.start(key);
  }

  /** The ending scene for a finished run. */
  protected ending(): void {
    this.go(session.state?.status === 'arrived' ? 'Arrival' : 'Death');
  }

  /** Centered heading line (bitmap font at an integer scale, x2 by default). */
  protected heading(y: number, text: string, scale = 2, color: number = COLORS.bright): Phaser.GameObjects.BitmapText {
    const x = Math.floor((GAME_WIDTH - text.length * CHAR_W * scale) / 2);
    return addText(this, x, y, text, { color, scale });
  }

  /**
   * At Titan Refinery: ask "via Oort Beacon / direct" (route.* keys), dispatch `route` (its log line shows in Travel), then
   * `onDone(true)`. Cancel (or Esc) calls `onDone(false)`. Elsewhere `onDone(true)` at once.
   */
  protected askRoute(onDone: (chosen: boolean) => void): void {
    const s = session.state;
    if (!s || s.arrivedAt !== ROUTE.branchAt) return onDone(true);
    const vias: RouteId[] = ['oort', 'direct'];
    const msg = [
      t('route.prompt'),
      `${t('route.oort')}: ${t('route.oortDesc', { n: fmt(gateToHeliopause('oort')) })}`,
      `${t('route.direct')}: ${t('route.directDesc', { n: fmt(gateToHeliopause('direct')) })}`,
    ].join('\n\n');
    this.modal(msg, {
      buttons: [t('route.oort'), t('route.direct'), t('travel.cancel')],
      onClose: (i) => {
        const via = vias[i];
        if (!via) return onDone(false);
        const r = applyAction(session.state!, { type: 'route', via }, session.rng);
        if (r.error) return this.modal(r.error, { onClose: () => onDone(false) });
        session.state = r.state;
        // The sim logged the chosen-route line (kind route); Travel's log shows it, so no extra confirmation.
        onDone(true);
      },
    });
  }
}
