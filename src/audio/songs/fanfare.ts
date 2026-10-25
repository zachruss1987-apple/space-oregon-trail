/** `fanfare`: bright arrival, then a warm loop. C major, 4/4, 120 BPM; 4 bar intro + 8 bar loop. Original. */
import type { SongDef } from '../types';
import { bars, perChord } from './helpers';

const leadIntro = ['G4:8 G4:8 C5:4 E5:4 G5:4', 'C6:4. G5:8 E5:2', 'F5:8 F5:8 A5:4 C6:4 A5:4', 'G5:8 B5:8 D6:4 C6:2'];
const thirdsIntro = ['E4:8 E4:8 G4:4 C5:4 E5:4', 'E5:4. C5:8 G4:2', 'D5:8 D5:8 F5:4 A5:4 F5:4', 'E5:8 G5:8 B5:4 E5:2'];
const leadLoop = [
  'E5:4 G5:4 E5:4 C5:4', 'D5:4 G5:4 B5:4 G5:4', 'C6:4 A5:4 E5:4 A5:4', 'A5:4. G5:8 F5:2',
  'E5:4 G5:4 C6:4 G5:4', 'A5:4 C6:4 F5:4 A5:4', 'B5:4 A5:4 G5:4 D5:4', 'G5:2 C5:2',
];
const thirdsLoop = [
  'C5:4 E5:4 C5:4 A4:4', 'B4:4 E5:4 G5:4 E5:4', 'A5:4 F5:4 C5:4 F5:4', 'F5:4. E5:8 D5:2',
  'C5:4 E5:4 A5:4 E5:4', 'F5:4 A5:4 D5:4 F5:4', 'G5:4 F5:4 E5:4 B4:4', 'E5:2 A4:2',
];
const bassIntro = ['C3:2 G2:2', 'A2:2 C3:2', 'F2:2 C3:2', 'G2:4 D3:4 G2:2'];
const W: Record<string, string> = {
  C: 'C3:4 E3:4 G3:4 E3:4', G: 'G2:4 B2:4 D3:4 B2:4', Am: 'A2:4 C3:4 E3:4 C3:4', F: 'F2:4 A2:4 C3:4 A2:4',
};
const bassLoop = perChord(['C', 'G', 'Am', 'F', 'C', 'F', 'G', 'C'], W);
const marchBars = (n: number): string => bars(Array.from({ length: n }, () => 'K:4 S:8 S:8 K:4 S:8 S:8'));

export const fanfare: SongDef = {
  id: 'fanfare',
  tempo: 120,
  meter: [4, 4],
  voices: { p1: 'p25', p2: 'p50', tri: 'tri' },
  channels: {
    p1: `@lead v13 ${bars(leadIntro)} | |: ${bars(leadLoop)} :|`,
    p2: `@lead v8 ${bars(thirdsIntro)} | |: ${bars(thirdsLoop)} :|`,
    tri: `@bass v13 ${bars(bassIntro)} | |: ${bassLoop} :|`,
    noise: `v7 ${marchBars(4)} | |: ${marchBars(8)} :|`,
  },
};
