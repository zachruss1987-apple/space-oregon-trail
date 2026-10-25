/**
 * Debris Threading (minigames.md section 2): side-scroll through the hazard's rock field, vertical movement only.
 * Rules live in threadingLogic; a clean run ends with the bonus pick (health or rations) before the result is sent.
 */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { THREADING_RUN } from '@/content';
import { markFlag } from '@/game/contract';
import { activeNumbers } from '@/gfx/palette';
import { ensureAnim } from '@/gfx/travelArt';
import type { GameState, ThreadingResult } from '@/sim';
import { t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { COLORS } from '@/ui/theme';
import { mt } from './copy';
import { MiniGameScene, type MiniGameInput } from './MiniGameScene';
import { Panel, type PanelLine } from './overlays';
import { addAnchored, anchorOf, SpritePool } from './pool';
import { createThreadingWorld, rockLive, rockX, stepThreading, threadingResult, type ThreadingWorld } from './threadingLogic';

const BONUS_DEPTH = 90;
const ROCK_SIZES = [48, 32, 24, 16] as const;

/** Largest rock sprite whose size fits the collision diameter (rock.16 at minimum). */
export const rockSprite = (r: number): string => `rock.${ROCK_SIZES.find((s) => s <= 2 * r) ?? 16}`;

export class ThreadingScene extends MiniGameScene<ThreadingResult> {
  protected readonly kind = 'threading' as const;
  protected readonly durationS = THREADING_RUN.durationS;
  private world!: ThreadingWorld;
  private gfx!: Phaser.GameObjects.Graphics;
  private pool!: SpritePool;
  private ship!: Phaser.GameObjects.Image;

  constructor() {
    super('Threading');
  }

  protected override music(): string {
    return 'mg.thread';
  }

  protected override hudIcons(): (string | null)[] {
    return ['ui.icon.hit'];
  }

  protected override isClean(r: ThreadingResult): boolean {
    return r.hits === 0;
  }

  protected setup(state: GameState): void {
    this.world = createThreadingWorld(state, this.rng);
    const f = THREADING_RUN.field;
    const pal = activeNumbers();
    this.add.graphics().lineStyle(1, pal.navy).lineBetween(0, f.top + 1, GAME_WIDTH, f.top + 1).lineBetween(0, f.bottom - 1, GAME_WIDTH, f.bottom - 1);
    this.gfx = this.add.graphics().setDepth(9);
    this.pool = new SpritePool(this, 10);
    this.ship = addAnchored(this, THREADING_RUN.shipX, 0, 'ship.mini').setDepth(12);
  }

  protected step(input: MiniGameInput): boolean {
    const w = this.world;
    const before = new Set(w.rocks.filter((k) => k.hit).map((k) => k.id));
    stepThreading(w, { dirY: input.dirY, target: input.target });
    if (w.events.includes('hit')) {
      this.flash(mt('minigame.threading.hit'));
      audio().sfx('collision');
      for (const k of w.rocks) if (k.hit && !before.has(k.id)) this.shatter(rockX(w, k), k.y);
    }
    return false;
  }

  /** `rock.shard` puff (plays once, then removed). */
  private shatter(x: number, y: number): void {
    const spr = anchorOf(this.add.sprite(Math.round(x), Math.round(y), 'rock.shard', 0), 'rock.shard').setDepth(11);
    spr.play(ensureAnim(this, 'rock.shard'));
    spr.once('animationcomplete', () => spr.destroy());
  }

  protected hud(): string[] {
    return [t('minigame.threading.hudHits', { hits: this.world.hits, n: this.world.hits })];
  }

  protected result(): { result: ThreadingResult } {
    return { result: threadingResult(this.world) };
  }

  /** Clean run: pick the bonus (1 health, 2 rations) before the result goes to the sim. */
  protected override finalize(result: ThreadingResult, done: (r: ThreadingResult) => void): void {
    if (result.hits > 0) return done(result);
    const panel = new Panel(this, [{ text: t('minigame.threading.resultClean'), color: COLORS.bright }, { text: t('minigame.bonusPick') }, { text: '' }, { text: '' }, { text: '' }]);
    const items = [{ label: t('minigame.threading.bonusHealth') }, { label: t('minigame.threading.bonusRations') }];
    const menu = new Menu(this, items, {
      x: GAME_WIDTH / 2 - 110, y: GAME_HEIGHT / 2 + 8, numbered: true, depth: BONUS_DEPTH,
      onSelect: (i) => pick(i === 1 ? 'rations' : 'health'),
    });
    const pick = (bonus: 'health' | 'rations'): void => {
      this.router.remove(menu);
      menu.destroy();
      panel.destroy();
      markFlag('modal', false);
      done(threadingResult(this.world, bonus));
    };
    markFlag('modal', true);
    this.router.push(menu);
  }

  protected resultLines(r: ThreadingResult): PanelLine[] {
    if (r.hits > 0) return [{ text: t('minigame.threading.resultHits', { hits: r.hits, n: r.hits }) }];
    const bonus = r.bonus === 'health' ? t('minigame.threading.bonusHealth') : r.bonus === 'rations' ? t('minigame.threading.bonusRations') : null;
    return [{ text: t('minigame.threading.resultClean'), color: COLORS.bright }, ...(bonus ? [{ text: bonus, color: COLORS.dim }] : [])];
  }

  protected draw(): void {
    const g = this.gfx.clear();
    const w = this.world;
    const pal = activeNumbers();
    g.fillStyle(pal.grey);
    for (const d of w.dust) g.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    this.pool.begin();
    for (const k of w.rocks) {
      if (!rockLive(w, k)) continue;
      const spin = (k.id * 97 + w.steps * 1.2) % 360;
      this.pool.get(rockSprite(k.r)).setPosition(Math.round(rockX(w, k)), Math.round(k.y)).setAngle(Math.round(spin / 90) * 90);
    }
    this.pool.end();
    const s = w.ship;
    const blink = s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0;
    this.ship.setPosition(THREADING_RUN.shipX, Math.round(s.y)).setAlpha(blink ? 0.25 : 1).setFrame(Math.floor(w.steps / 8) % 2);
  }
}
