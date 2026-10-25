/**
 * Debris Threading (minigames.md section 2): side-scroll through the hazard's rock field, vertical movement only.
 * Rules live in threadingLogic; a clean run ends with the bonus pick (health or rations) before the result is sent.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { THREADING_RUN } from '@/content';
import { markFlag } from '@/game/contract';
import type { GameState, ThreadingResult } from '@/sim';
import { t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { COLORS } from '@/ui/theme';
import { mt } from './copy';
import { MiniGameScene, type MiniGameInput } from './MiniGameScene';
import { Panel, type PanelLine } from './overlays';
import { createThreadingWorld, rockLive, rockX, stepThreading, threadingResult, type ThreadingWorld } from './threadingLogic';

const GREEN = 0x5cff5c;
const BRIGHT = 0xc8ffc8;
const AMBER = 0xffd75c;
const DUST = 0x2e8a2e;
const BONUS_DEPTH = 90;

export class ThreadingScene extends MiniGameScene<ThreadingResult> {
  protected readonly kind = 'threading' as const;
  protected readonly durationS = THREADING_RUN.durationS;
  private world!: ThreadingWorld;
  private gfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Threading');
  }

  protected setup(state: GameState): void {
    this.world = createThreadingWorld(state, this.rng);
    const f = THREADING_RUN.field;
    this.add.graphics().lineStyle(1, 0x123d12).lineBetween(0, f.top + 1, GAME_WIDTH, f.top + 1).lineBetween(0, f.bottom - 1, GAME_WIDTH, f.bottom - 1);
    this.gfx = this.add.graphics().setDepth(10);
  }

  protected step(input: MiniGameInput): boolean {
    stepThreading(this.world, { dirY: input.dirY, target: input.target });
    if (this.world.events.includes('hit')) this.flash(mt('minigame.threading.hit'));
    return false;
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
    g.fillStyle(DUST);
    for (const d of w.dust) g.fillRect(d.x, d.y, 1, 1);
    for (const k of w.rocks) {
      if (!rockLive(w, k)) continue;
      const x = rockX(w, k);
      const spin = (k.id * 1.7 + w.steps * 0.02) % (Math.PI * 2);
      const pts = Array.from({ length: 7 }, (_, i) => {
        const a = spin + (i / 7) * Math.PI * 2;
        const rr = k.r * (i % 2 === 0 ? 1 : 0.8);
        return new Phaser.Math.Vector2(x + Math.cos(a) * rr, k.y + Math.sin(a) * rr);
      });
      g.lineStyle(2, AMBER).strokePoints(pts, true);
    }
    const s = w.ship;
    if (s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0) return;
    const { shipX: x, ship } = THREADING_RUN;
    const hw = ship.w / 2;
    const hh = ship.h / 2;
    g.fillStyle(GREEN).fillTriangle(x + hw, s.y, x - hw, s.y - hh, x - hw, s.y + hh);
    g.lineStyle(1, BRIGHT).lineBetween(x - hw - 4, s.y, x - hw, s.y);
  }
}
