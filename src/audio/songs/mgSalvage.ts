/** `mg.salvage`: bouncy, busy. E minor, 4/4, 128 BPM; 8 bar loop, no intro. Original. */
import type { SongDef } from '../types';
import { bars, perChord, rep } from './helpers';

const chords = ['Em', 'Em', 'C', 'D', 'Em', 'C', 'D', 'B'];
const arp = (t: string): string => `[${t}]:8 r:8 [${t}]:8 [${t}]:8 r:8 [${t}]:8 [${t}]:8 r:8`;
const ARP: Record<string, string> = {
  Em: arp('E4 G4 B4'), C: arp('E4 G4 C5'), D: arp('F#4 A4 D5'), B: arp('F#4 B4 D#5'),
};
const BASS: Record<string, string> = {
  Em: rep('E2:8 B2:8', 4), C: rep('C2:8 E2:8', 4), D: rep('D2:8 A2:8', 4), B: rep('B1:8 F#2:8', 4),
};
const lead = [
  'B5:8 G5:8 E5:4 G5:4 B5:4', 'A5:4 G5:4 E5:2', 'E5:8 G5:8 C6:4 B5:4 G5:4', 'F#5:4 A5:4 D6:2',
  'B5:8 G5:8 E5:4 G5:4 B5:4', 'C6:4 G5:4 E5:4 G5:4', 'A5:4 F#5:4 D5:4 F#5:4', 'D#5:4 F#5:4 B4:2',
];

export const salvage: SongDef = {
  id: 'mg.salvage',
  tempo: 128,
  meter: [4, 4],
  voices: { p1: 'p12', p2: 'p25', tri: 'tri' },
  channels: {
    p1: `@pluck @arp=30 v7 |: ${perChord(chords, ARP)} :|`,
    p2: `@lead v11 |: ${bars(lead)} :|`,
    tri: `@bass v13 |: ${perChord(chords, BASS)} :|`,
    noise: `v6 |: ${bars(chords.map(() => 'K:4 H:8 H:8 K:4 H:8 H:8'))} :|`,
  },
};
