/** Scene registry; the first entry starts on boot. */
import { SetupScene } from './SetupScene';
import { StoreScene } from './StoreScene';
import { TitleScene } from './TitleScene';

export const SCENES = [TitleScene, SetupScene, StoreScene];
