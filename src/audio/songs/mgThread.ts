/** `mg.thread`: driving, tense. A minor, 4/4, 150 BPM; 8 bar loop, no intro. Original. */
import type { SongDef } from '../types';
import { bars, perChord, rep } from './helpers';

const chords = ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'];
const BASS: Record<string, string> = {
  Am: rep('A2:8 E3:8', 4), F: rep('F2:8 F2:8 C3:8 C3:8', 2), G: rep('G2:8 B2:8', 4), E: rep('E2:8 E2:8 B1:8 B1:8', 2),
};
const lead = [
  'A5:8 C6:8 E6:8 C6:8 A5:4 E5:4', 'A5:8 B5:8 C6:4 B5:4 A5:4', 'A5:8 C6:8 F6:8 C6:8 A5:4 F5:4', 'B5:8 D6:8 G6:8 D6:8 B5:2',
  'E6:8 D6:8 C6:8 B5:8 A5:4 E5:4', 'C6:8 F6:8 A6:4 G6:4 E6:4', 'F6:8 E6:8 D6:8 C6:8 A5:4 C6:4', 'B5:8 G#5:8 E5:8 G#5:8 B5:2',
];

export const thread: SongDef = {
  id: 'mg.thread',
  tempo: 150,
  meter: [4, 4],
  voices: { p1: 'p25', tri: 'tri' },
  channels: {
    p1: `@lead v11 |: ${bars(lead)} :|`,
    tri: `@bass v13 |: ${perChord(chords, BASS)} :|`,
    noise: `v7 |: ${bars(chords.map(() => 'K:4 S:4 K:8 K:8 S:4'))} :|`,
  },
};
