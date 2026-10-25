/** Scene registry; the first entry starts on boot. */
import { SetupScene } from './SetupScene';
import { TitleScene } from './TitleScene';

export const SCENES = [TitleScene, SetupScene];
