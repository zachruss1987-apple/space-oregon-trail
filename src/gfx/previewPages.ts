/** Dynamic gallery pages for the gfx preview: travel composition and title hero. Dev-only. */
import Phaser from 'phaser';
import type { WeatherId } from '@/content/windows';
import { WEATHER_ORDER } from '@/content/windows';
import { addSprite, createStarfield, drawTitleHero, landmarkScale } from './travelArt';
import { createWeatherOverlay, drawPhaseTint } from './weatherArt';
import type { PaletteNumbers } from './palette';

type Updater = (dtMs: number) => void;
type Page = Phaser.GameObjects.GameObject[];

const label = (scene: Phaser.Scene, x: number, y: number, s: string, color: number): Phaser.GameObjects.BitmapText =>
  scene.add.bitmapText(x, y, 'retro6', s.toUpperCase()).setTint(color).setOrigin(0, 0);

/** Page: starfield + ship + landmark at the three approach tiers + each weather overlay. */
export function travelPage(scene: Phaser.Scene, pal: PaletteNumbers, updaters: Updater[]): Page {
  const box = scene.add.container(0, 0);
  const objs: Phaser.GameObjects.GameObject[] = [];
  const band = scene.add.rectangle(0, 8, 640, 140, pal.black).setOrigin(0, 0);
  objs.push(band);
  const tint = scene.add.graphics({ x: 0, y: 8 });
  drawPhaseTint(tint, 8);
  objs.push(tint);
  const stars = createStarfield(scene, { x: 0, y: 8 });
  Object.values(stars.layers).forEach((g) => objs.push(g));
  updaters.push((dt) => stars.update(dt, 1));
  [-14, 0, 14].forEach((dy) => objs.push(addSprite(scene, 158, 88 + dy, 'ship.flare.cruise').setOrigin(1, 0.5)));
  objs.push(scene.add.image(160, 88, 'ship.hauler', 0).setOrigin(0.5, 0.5));
  // approach tiers: mk 100 (blip), 40 (far icon), 10 (full sprite)
  const blip = landmarkScale(100), far = landmarkScale(40), full = landmarkScale(10);
  objs.push(scene.add.rectangle(blip.x, 80, 2, 2, pal.amber).setOrigin(0.5, 0.5));
  objs.push(scene.add.image(far.x, 80, 'far.planet').setOrigin(0.5, 0.5));
  objs.push(addSprite(scene, full.x, 80, 'landmark.gate'));
  objs.push(label(scene, 4, 12, `approach mk100 x${blip.x} | mk40 x${far.x} | mk10 x${full.x}`, pal.phosphor));
  // weather strips: 2 columns x 3 rows
  WEATHER_ORDER.forEach((wx: WeatherId, i) => {
    const bx = 4 + (i % 2) * 318, by = 156 + Math.floor(i / 2) * 76;
    objs.push(scene.add.rectangle(bx, by + 10, 312, 56, pal.black).setOrigin(0, 0));
    const sf = createStarfield(scene, { x: bx, y: by + 10, width: 312, height: 56 });
    Object.values(sf.layers).forEach((g) => objs.push(g));
    const ov = createWeatherOverlay(scene, wx, { x: bx, y: by + 10, w: 312, h: 56 });
    objs.push(...ov.objects);
    updaters.push((dt) => {
      sf.update(dt, 1);
      ov.update(dt);
    });
    objs.push(label(scene, bx, by, wx, pal.phosphorHi));
  });
  box.add(objs);
  return [box];
}

/** Page: the title hero band, logo and subtitle. */
export function heroPage(scene: Phaser.Scene, pal: PaletteNumbers, updaters: Updater[]): Page {
  const box = scene.add.container(0, 0);
  const hero = drawTitleHero(scene, 0, 20);
  updaters.push((dt) => hero.update(dt));
  const logo = 'THE PROXIMA TRAIL';
  const shadow = scene.add.bitmapText(49, 183, 'retro8', logo).setTint(pal.brown).setScale(4).setOrigin(0, 0);
  const text = scene.add.bitmapText(48, 182, 'retro8', logo).setTint(pal.amber).setScale(4).setOrigin(0, 0);
  const sub = scene.add.bitmapText(48, 240, 'retro8', 'IT IS A LONG WAY TO PROXIMA. YOU WILL NOT ALL MAKE IT.').setTint(pal.phosphor).setScale(1).setOrigin(0, 0);
  box.add([...hero.objects, shadow, text, sub]);
  return [box];
}
