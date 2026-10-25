/**
 * Header band for Waypoint / Station / Hazard: black sky with a still starfield, the waypoint's art (station exterior,
 * landmark, or hazard composition), the name at x2 and an optional sub-line, closed by a forest rule.
 */
import type Phaser from 'phaser';
import { GAME_WIDTH } from '@/config';
import { session } from '@/game/session';
import { activeNumbers } from '@/gfx/palette';
import { ALL_SPRITES } from '@/gfx/sprites';
import { createStarfield } from '@/gfx/travelArt';
import { drawWaypointArt, waypointSprite } from '@/gfx/waypointArt';
import { addText } from '@/ui/text';
import { COLORS } from '@/ui/theme';

export interface ArtBandOptions {
  /** Band height (default 140). */
  h?: number;
  /** Centre x of the art (default 540). */
  artX?: number;
  /** Box for hazard compositions. */
  artW?: number;
  title?: string;
  sub?: string;
}

/** Draw the band at the top of the scene; returns its bottom y. */
export function artBand(scene: Phaser.Scene, waypoint: number, o: ArtBandOptions = {}): number {
  const h = o.h ?? 140;
  const pal = activeNumbers();
  const reduced = session.settings.reducedMotion;
  scene.add.rectangle(0, 0, GAME_WIDTH, h, pal.black).setOrigin(0, 0);
  createStarfield(scene, { height: h, random: () => session.uiRng.next(), reducedMotion: true });
  const name = waypointSprite(waypoint);
  const def = name ? ALL_SPRITES.find((d) => d.name === name) : undefined;
  // bottom-anchored sprites stand on the band floor; the rest are centred
  const y = def && def.anchor[1] === def.h - 1 ? h - 4 : Math.floor(h / 2);
  drawWaypointArt(scene, waypoint, o.artX ?? 540, y, o.artW ?? 360, h - 8, reduced);
  if (o.title) addText(scene, 12, 10, o.title, { color: COLORS.bright, scale: 2 });
  if (o.sub) addText(scene, 12, 32, o.sub, { color: COLORS.dim });
  scene.add.rectangle(0, h - 1, GAME_WIDTH, 1, pal.forest).setOrigin(0, 0);
  return h;
}
