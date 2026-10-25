/** `dirge`: wry, mournful, hymn-like. A minor, 3/4, 60 BPM; 4 bar intro + 8 bar loop. Original. */
import type { SongDef } from '../types';
import { bars } from './helpers';

const intro = ['A4:2 C5:4', 'D5:2 F5:4', 'B4:2 G#4:4', 'A4:2.'];
const loop = ['C5:2 E5:4', 'A5:2 C6:4', 'D5:2 A4:4', 'G#4:2 B4:4', 'C5:2 B4:4', 'D5:2 B4:4', 'E5:4 D5:4 B4:4', 'A4:2.'];
const bassIntro = ['A2:2.', 'D2:2.', 'E2:2.', 'A2:2.'];
const bassLoop = ['A2:2.', 'F2:2.', 'D2:2.', 'E2:2.', 'A2:2.', 'G2:2.', 'E2:2.', 'A2:2.'];
const toll = (n: number): string => bars(Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'C:4 r:2' : 'r:2.')));

export const dirge: SongDef = {
  id: 'dirge',
  tempo: 60,
  meter: [3, 4],
  voices: { p1: 'p50', tri: 'tri' },
  channels: {
    p1: `@swell v9 @vib=8,5 ${bars(intro)} | |: ${bars(loop)} :|`,
    tri: `@organ v11 ${bars(bassIntro)} | |: ${bars(bassLoop)} :|`,
    noise: `v5 ${toll(4)} | |: ${toll(8)} :|`,
  },
};
