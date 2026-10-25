/** `travel`: calm, rolling, a little lonely. G mixolydian, 4/4, 92 BPM; 16 bar loop, no intro. Original melody. */
import type { SongDef } from '../types';
import { bars } from './helpers';

const lead = [
  'B4:2 D5:2', 'E5:2. D5:4', 'C5:2 A4:2', 'C5:1',
  'E5:2 G5:2', 'E5:2. D5:4', 'B4:2 D5:4 B4:4', 'G4:1',
  'D5:2 B4:2', 'C5:2 E5:2', 'A4:2 C5:2', 'F5:2. E5:4',
  'G5:2 E5:2', 'C5:2 A4:2', 'D5:2. B4:4', 'G4:2 r:2',
];
const chords = ['G', 'G', 'F', 'F', 'C', 'C', 'G', 'G', 'G', 'Am', 'F', 'F', 'C', 'F', 'G', 'G'];
const WALK: Record<string, string> = {
  G: 'G2:4 B2:4 D3:4 B2:4',
  F: 'F2:4 A2:4 C3:4 A2:4',
  C: 'C3:4 E3:4 G3:4 E3:4',
  Am: 'A2:4 C3:4 E3:4 C3:4',
};

export const travel: SongDef = {
  id: 'travel',
  tempo: 92,
  meter: [4, 4],
  voices: { p1: 'p50', tri: 'tri' },
  channels: {
    p1: `@pad v8 |: ${bars(lead)} :|`,
    tri: `@bass v12 |: ${bars(chords.map((c) => WALK[c] as string))} :|`,
    noise: `@hat v5 |: ${bars(chords.map(() => 'H:4 H:4 H:4 H:4'))} :|`,
  },
};
