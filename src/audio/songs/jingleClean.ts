/** `jingle.clean`: smug little win. C major, 4/4, 150 BPM; 2 bars, one-shot sting. Original. */
import type { SongDef } from '../types';

export const jingleClean: SongDef = {
  id: 'jingle.clean',
  tempo: 150,
  meter: [4, 4],
  voices: { p1: 'p25', p2: 'p12', tri: 'tri' },
  channels: {
    p1: '@lead v13 C5:8 E5:8 G5:8 C6:8 r:8 G5:8 C6:4 | E6:4. D6:8 C6:2',
    p2: '@pluck v8 E4:8 G4:8 C5:8 E5:8 r:8 E5:8 E5:4 | G5:4. F5:8 E5:2',
    tri: '@bass v13 C3:2 E3:2 | G2:2 C3:2',
  },
};
