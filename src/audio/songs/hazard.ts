/** `hazard`: uneasy, ticking. E minor, 4/4, 100 BPM; 8 bar loop, no intro. Original. */
import type { SongDef } from '../types';
import { bars, perChord, rep } from './helpers';

const chords = ['Em', 'Em', 'Em', 'Em', 'C', 'C', 'B', 'B'];
const tick = (a: string, b: string, c: string): string => `${a}:8 r:8 ${b}:8 r:8 ${a}:8 r:8 ${c}:8 r:8`;
const OST: Record<string, string> = {
  Em: tick('E5', 'B4', 'G5'), C: tick('E5', 'C5', 'G5'), B: tick('F#5', 'B4', 'D#5'),
};
const PED: Record<string, string> = { Em: 'E2:1', C: 'C2:1', B: 'B1:1' };

export const hazard: SongDef = {
  id: 'hazard',
  tempo: 100,
  meter: [4, 4],
  voices: { p2: 'p12', tri: 'tri' },
  channels: {
    p2: `@pluck v10 |: ${perChord(chords, OST)} :|`,
    tri: `@organ v12 |: ${perChord(chords, PED)} :|`,
    noise: `@hat v5 |: ${bars(chords.map(() => rep('H:8', 8)))} :|`,
  },
};
