/** `danger`: startle, then hold. C diminished, 4/4, 140 BPM; 2 bars, one-shot sting. Original. */
import type { SongDef } from '../types';

export const danger: SongDef = {
  id: 'danger',
  tempo: 140,
  meter: [4, 4],
  voices: { p1: 'saw', tri: 'tri' },
  channels: {
    p1: '@lead v13 C6:8 A5:8 Gb5:8 Eb5:8 C6:2 | @swell Gb5:1',
    tri: '@bass v14 C3:4 Gb2:4 C2:2 | C2:1',
    noise: 'v12 C:1 | r:1',
  },
};
