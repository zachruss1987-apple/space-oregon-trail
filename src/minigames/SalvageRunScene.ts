/** Salvage Run (minigames.md section 1): the drone, the drifting field, the grapple. Rules live in salvageLogic. */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { SALVAGE_RUN, type DebrisId } from '@/content';
import { activeNumbers } from '@/gfx/palette';
import { haulUnits, partsPhrase, type GameState, type SalvageResult } from '@/sim';
import { t } from '@/ui/copy';
import { COLORS } from '@/ui/theme';
import { eventLine, mt } from './copy';
import { MiniGameScene, type MiniGameInput } from './MiniGameScene';
import type { PanelLine } from './overlays';
import { addAnchored, SpritePool } from './pool';
import { createSalvageWorld, salvageOutcome, salvageOver, stepSalvage, type Debris, type SalvageEvent, type SalvageWorld } from './salvageLogic';

/** Flash line per logic event. */
const FLASH: Partial<Record<SalvageEvent, () => string>> = {
  holdFull: () => t('minigame.holdFull'),
  click: () => t('minigame.outOfCharges'),
  scrap: () => mt('minigame.salvage.scrap'),
  snap: () => mt('minigame.salvage.snap'),
  hit: () => mt('minigame.salvage.hit'),
  hot: () => mt('minigame.salvage.hot'),
};

/** Sound per logic event (audio.md "SFX"). */
const SOUND: Partial<Record<SalvageEvent, string>> = {
  fire: 'grapple.fire', hook: 'grapple.attach', snap: 'grapple.snap', click: 'grapple.empty', hit: 'collision',
  hot: 'hull.hit', wrecked: 'crash', collect: 'store.buy', scrap: 'event.ding',
};

/** Sprite name and frame for a debris piece at step `steps`. */
function debrisSprite(p: Debris, steps: number): [string, number] {
  const type: DebrisId = p.type;
  switch (type) {
    case 'scrap': return [p.r * 2 <= 10 ? 'debris.scrap.s' : p.r * 2 <= 16 ? 'debris.scrap.m' : 'debris.scrap.l', 0];
    case 'tumbler': return ['debris.tumbler', Math.floor(Math.abs(p.spin * steps * 0.08) / (Math.PI / 2)) % 4];
    case 'hot': return ['debris.hot', Math.floor(steps / 15) % 2];
    case 'galley': return ['debris.galley', Math.floor(steps / 30) % 2];
    case 'gyro': return ['debris.gyro', Math.floor(steps / 10) % 2];
    default: return [`debris.${type}`, 0];
  }
}

export class SalvageRunScene extends MiniGameScene<SalvageResult> {
  protected readonly kind = 'salvage' as const;
  protected readonly durationS = SALVAGE_RUN.durationS;
  protected override readonly actionKey = 'minigame.common.fire';
  private world!: SalvageWorld;
  private gfx!: Phaser.GameObjects.Graphics;
  private pool!: SpritePool;
  private drone!: Phaser.GameObjects.Image;
  private hookImg!: Phaser.GameObjects.Image;
  /** True while the `grapple.reel` loop is sounding. */
  private reeling = false;

  constructor() {
    super('Salvage');
  }

  protected override music(): string {
    return 'mg.salvage';
  }

  protected override hudIcons(): (string | null)[] {
    return ['ui.icon.charge', 'ui.icon.hp', 'ui.icon.haul'];
  }

  protected override silence(): void {
    this.reeling = false;
    audio().stopSfx('grapple.reel');
  }

  protected override isClean(r: SalvageResult): boolean {
    return haulUnits(r) >= 100;
  }

  protected setup(state: GameState): void {
    this.world = createSalvageWorld(state);
    this.reeling = false;
    const f = SALVAGE_RUN.field;
    const pal = activeNumbers();
    const g = this.add.graphics();
    for (let i = 0; i < 50; i++) g.fillStyle(this.rng.chance(0.2) ? pal.silver : pal.grey).fillRect(this.rng.int(0, f.right), this.rng.int(f.top, f.bottom), 1, 1);
    addAnchored(this, 0, Math.floor((f.top + f.bottom) / 2), 'ship.dock');
    this.gfx = this.add.graphics().setDepth(11);
    this.pool = new SpritePool(this, 10);
    this.hookImg = addAnchored(this, 0, 0, 'grapple.hook').setDepth(12).setVisible(false);
    this.drone = addAnchored(this, 0, 0, 'drone').setDepth(13);
  }

  protected step(input: MiniGameInput): boolean {
    stepSalvage(this.world, input, this.rng);
    for (const e of this.world.events) {
      const line = FLASH[e];
      if (line) this.flash(line(), e === 'scrap' ? COLORS.dim : COLORS.warn);
      const sound = SOUND[e];
      if (sound) audio().sfx(sound);
    }
    const gr = this.world.grapple;
    // The reel loops while the hook hauls something in (audio.md "grapple.reel"), and stops when it lands or snaps.
    const reeling = gr?.phase === 'reeling';
    if (reeling && !this.reeling) audio().sfx('grapple.reel');
    else if (!reeling && this.reeling) audio().stopSfx('grapple.reel');
    this.reeling = reeling;
    return salvageOver(this.world);
  }

  protected hud(): string[] {
    const w = this.world;
    return [
      t('minigame.salvage.hudCharges', { n: w.chargesLeft }),
      t('minigame.salvage.hudHp', { n: Math.max(0, w.drone.hp) }),
      t('minigame.salvage.hudHold', { n: haulUnits(w.haul) }),
    ];
  }

  protected result(): { result: SalvageResult; notes?: PanelLine[] } {
    const { result, overweight } = salvageOutcome(this.world);
    const notes = overweight > 0
      ? [{ text: eventLine('salvage.overweight', { n: overweight }, 'You could only tow {n} units back.'), color: COLORS.warn }]
      : [];
    return { result, notes };
  }

  protected resultLines(r: SalvageResult): PanelLine[] {
    const parts = partsPhrase({ plates: r.plates, pumps: r.pumps, gyros: r.gyros });
    const haul = r.rations > 0 && parts ? t('minigame.salvage.resultHaul', { n: r.rations, parts })
      : r.rations > 0 ? mt('minigame.salvage.resultRations', { n: r.rations })
        : parts ? mt('minigame.salvage.resultParts', { parts }) : t('minigame.salvage.resultNothing');
    return [
      ...(r.droneWrecked ? [{ text: t('minigame.salvage.droneWrecked'), color: COLORS.warn }] : []),
      { text: haul },
      { text: t('minigame.salvage.chargesUsed', { n: r.chargesUsed }), color: COLORS.dim },
    ];
  }

  protected draw(): void {
    const w = this.world;
    const d = w.drone;
    const blip = w.params.blipRange;
    this.pool.begin();
    for (const p of w.debris) {
      if (blip !== null && !p.hooked && Math.hypot(p.x - d.x, p.y - d.y) > blip) {
        this.pool.get('debris.blip').setPosition(Math.round(p.x), Math.round(p.y));
        continue;
      }
      const [name, frame] = debrisSprite(p, w.steps);
      this.pool.get(name).setFrame(frame).setPosition(Math.round(p.x), Math.round(p.y));
    }
    this.pool.end();
    this.drawGrapple();
    const blink = d.invuln > 0 && Math.floor(d.invuln * 10) % 2 === 0;
    this.drone.setPosition(Math.round(d.x), Math.round(d.y)).setAlpha(blink ? 0.25 : 1);
    this.drone.setFrame(Math.floor(w.steps / 15) % 2);
    if (w.wrecked) this.drone.setTint(activeNumbers().grey);
    else this.drone.clearTint();
  }

  /** art.md grapple line: flying = silver dashed (every 4th pixel black); reeling = solid silver + a travelling amber pixel. */
  private drawGrapple(): void {
    const g = this.gfx.clear();
    const gr = this.world.grapple;
    const d = this.world.drone;
    if (!gr) {
      this.hookImg.setVisible(false);
      return;
    }
    const pal = activeNumbers();
    const tip = gr.phase === 'flying' ? { x: gr.origin.x + gr.dir.x * gr.dist, y: gr.origin.y + gr.dir.y * gr.dist } : gr.target ?? gr.from;
    const len = Math.max(1, Math.round(Math.hypot(tip.x - d.x, tip.y - d.y)));
    for (let i = 0; i <= len; i++) {
      const x = Math.round(d.x + ((tip.x - d.x) * i) / len);
      const y = Math.round(d.y + ((tip.y - d.y) * i) / len);
      g.fillStyle(gr.phase === 'flying' && i % 4 === 3 ? pal.black : pal.silver, 1).fillRect(x, y, 1, 1);
    }
    if (gr.phase === 'reeling') {
      const k = 1 - ((this.world.steps % 20) / 20);
      g.fillStyle(pal.amber, 1).fillRect(Math.round(d.x + (tip.x - d.x) * k), Math.round(d.y + (tip.y - d.y) * k), 1, 1);
    }
    this.hookImg.setVisible(true).setPosition(Math.round(tip.x), Math.round(tip.y)).setFrame(gr.phase === 'flying' ? 0 : 1);
  }
}
