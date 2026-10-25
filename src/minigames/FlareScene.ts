/**
 * Flare Belt Finale (minigames.md section 3): steer in 2D between flare arcs for 45 s; 5 hits is a crash (early end).
 * Rules live in flareLogic. A clean run earns "Rode the wind" (the sim sets `rodeTheWind`).
 */
import Phaser from 'phaser';
import { FLARE_RUN } from '@/content';
import type { FlareResult, GameState } from '@/sim';
import { t } from '@/ui/copy';
import { COLORS } from '@/ui/theme';
import { mt } from './copy';
import { arcPhase, createFlareWorld, flareElapsed, flareOver, flareResult, stepFlare, type FlareWorld } from './flareLogic';
import { MiniGameScene, type MiniGameInput } from './MiniGameScene';
import type { PanelLine } from './overlays';

const GREEN = 0x5cff5c;
const BRIGHT = 0xc8ffc8;
const FLARE = 0xffb03c;
const HOT = 0xfff0a0;

export class FlareScene extends MiniGameScene<FlareResult> {
  protected readonly kind = 'flare' as const;
  protected readonly durationS = FLARE_RUN.durationS;
  private world!: FlareWorld;
  private gfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Flare');
  }

  protected setup(state: GameState): void {
    this.world = createFlareWorld(state, this.rng);
    const f = FLARE_RUN.field;
    const g = this.add.graphics();
    for (let i = 0; i < 40; i++) g.fillStyle(this.rng.chance(0.3) ? 0x3d2a12 : 0x1d140a).fillRect(this.rng.int(0, f.right), this.rng.int(f.top, f.bottom), 1, 1);
    this.gfx = this.add.graphics().setDepth(10);
  }

  protected step(input: MiniGameInput): boolean {
    stepFlare(this.world, input);
    const ev = this.world.events;
    if (ev.includes('crash')) this.flash(t('minigame.flare.crash'));
    else if (ev.includes('hit')) this.flash(mt('minigame.flare.hit'));
    return this.world.crashed;
  }

  protected hud(): string[] {
    return [t('minigame.flare.hudHits', { hits: this.world.hits, n: this.world.hits })];
  }

  protected result(): { result: FlareResult } {
    return { result: flareResult(this.world) };
  }

  protected resultLines(r: FlareResult): PanelLine[] {
    if (r.hits >= 5) return [{ text: t('minigame.flare.crash'), color: COLORS.warn }];
    if (r.hits === 0) return [{ text: t('minigame.flare.rodeTheWind'), color: COLORS.bright, size: 18 }];
    return [{ text: mt('minigame.flare.resultHits', { hits: r.hits, n: r.hits }) }];
  }

  protected draw(): void {
    const g = this.gfx.clear();
    const w = this.world;
    const now = flareElapsed(w);
    for (const arc of w.arcs) {
      const phase = arcPhase(w.params, arc, now);
      if (phase === 'pending' || phase === 'gone') continue;
      const pts = arc.pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
      if (phase === 'telegraph') g.lineStyle(1, FLARE, 0.5).strokePoints(pts, false);
      else if (phase === 'active') g.lineStyle(FLARE_RUN.arc.thickness, FLARE, 0.9).strokePoints(pts, false).lineStyle(4, HOT).strokePoints(pts, false);
      else g.lineStyle(FLARE_RUN.arc.thickness / 2, FLARE, 0.3).strokePoints(pts, false);
    }
    const s = w.ship;
    if (!flareOver(w) && s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0) return;
    const r = FLARE_RUN.ship.radius;
    g.fillStyle(w.crashed ? 0x6b6b6b : GREEN).fillTriangle(s.x + r * 1.5, s.y, s.x - r, s.y - r, s.x - r, s.y + r);
    g.lineStyle(1, BRIGHT).strokeCircle(s.x, s.y, r);
  }
}
