/** `station`: busy general store, ragtime lilt. F major, 2/4, 104 BPM; 16 bar loop, no intro. Original melody. */
import type { SongDef } from '../types';
import { bars, perChord } from './helpers';

const lead = [
  'A4:8 C5:4 A4:8', 'F5:8 E5:8 D5:8 C5:8', 'E5:8 G5:4 E5:8', 'C5:4 A4:4',
  'D5:8 F5:4 D5:8', 'C5:8 A4:8 F4:8 A4:8', 'G4:8 C5:8 E5:8 D5:8', 'C5:4 r:4',
  'D5:8 F5:4 A4:8', 'A5:8 F5:8 D5:8 F5:8', 'G4:8 Bb4:4 D5:8', 'E5:8 D5:8 C5:8 B4:8',
  'A4:8 C5:4 F5:8', 'D6:8 C6:8 Bb5:8 A5:8', 'G5:8 E5:8 D5:8 B4:8', 'A4:8 C5:8 F5:4',
];
const chords = ['F', 'F', 'C', 'F', 'Bb', 'F', 'C', 'F', 'Dm', 'Dm', 'Gm', 'C', 'F', 'Bb', 'C', 'F'];
const OOM: Record<string, string> = {
  F: 'F2:4 C3:4', C: 'C3:4 G3:4', Bb: 'Bb2:4 F3:4', Dm: 'D3:4 A3:4', Gm: 'G2:4 D3:4',
};
const off = (t: string): string => `r:8 [${t}]:8 r:8 [${t}]:8`;
const OFF: Record<string, string> = {
  F: off('A4 C5 F5'), C: off('G4 C5 E5'), Bb: off('Bb4 D5 F5'), Dm: off('A4 D5 F5'), Gm: off('Bb4 D5 G5'),
};

export const station: SongDef = {
  id: 'station',
  tempo: 104,
  meter: [2, 4],
  voices: { p1: 'p25', p2: 'p50', tri: 'tri' },
  channels: {
    p1: `@lead v12 |: ${bars(lead)} :|`,
    p2: `@organ @arp=24 v6 |: ${perChord(chords, OFF)} :|`,
    tri: `@bass v13 |: ${perChord(chords, OOM)} :|`,
  },
};
