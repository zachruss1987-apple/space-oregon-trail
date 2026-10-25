/**
 * Sprite registry. To add sprites: create a data file in this folder exporting `SpriteDef[]`,
 * import it here and spread it into ALL_SPRITES. Tests validate every entry automatically.
 */
import type { SpriteDef } from '../spriteParse';
import { SHIP_SPRITES } from './ship';
import { FLARE_SPRITES } from './flares';
import { CRAFT_SPRITES } from './craft';
import { DEBRIS_SPRITES } from './debris';
import { DEBRIS2_SPRITES } from './debris2';
import { UI_SPRITES } from './ui';
import { PORTRAITS_1_2 } from './portraits12';
import { PORTRAITS_3_4 } from './portraits34';
import { PORTRAITS_5 } from './portraits5';

export const ALL_SPRITES: SpriteDef[] = [
  ...SHIP_SPRITES,
  ...FLARE_SPRITES,
  ...CRAFT_SPRITES,
  ...DEBRIS_SPRITES,
  ...DEBRIS2_SPRITES,
  ...UI_SPRITES,
  ...PORTRAITS_1_2,
  ...PORTRAITS_3_4,
  ...PORTRAITS_5,
];
