/** `mg.flare`: heat and urgency. D phrygian, 4/4, 160 BPM; 16 bar loop, no intro. Original. */
import type { SongDef } from '../types';
import { bars, perChord, rep } from './helpers';

const chords = ['Dm', 'Dm', 'Eb', 'Eb', 'Dm', 'Dm', 'C', 'C', 'Dm', 'Dm', 'Eb', 'Eb', 'Gm', 'Eb', 'A', 'A'];
const stab = (a: string, b: string, c: string, d: string): string => `${a}:8 r:8 ${b}:8 r:8 ${c}:8 r:8 ${d}:4`;
const STAB: Record<string, string> = {
  Dm: stab('D5', 'D5', 'F5', 'A5'), Eb: stab('Eb5', 'Eb5', 'G5', 'Bb5'), C: stab('C5', 'E5', 'G5', 'E5'),
  Gm: stab('G4', 'G4', 'Bb4', 'D5'), A: stab('A4', 'A4', 'C#5', 'E5'),
};
const arp = (t: string): string => `[${t}]:2 [${t}]:2`;
const ARP: Record<string, string> = {
  Dm: arp('D4 F4 A4 D5'), Eb: arp('Eb4 G4 Bb4 Eb5'), C: arp('C4 E4 G4 C5'), Gm: arp('G3 Bb3 D4 G4'), A: arp('A3 C#4 E4 A4'),
};
const BASS: Record<string, string> = {
  Dm: rep('D2:8 D2:8 D3:8 D2:8', 2), Eb: rep('Eb2:8 Eb2:8 Eb3:8 Eb2:8', 2), C: rep('C2:8 C2:8 C3:8 C2:8', 2),
  Gm: rep('G1:8 G1:8 G2:8 G1:8', 2), A: rep('A1:8 A1:8 A2:8 A1:8', 2),
};

export const flare: SongDef = {
  id: 'mg.flare',
  tempo: 160,
  meter: [4, 4],
  voices: { p1: 'saw', p2: 'p12', tri: 'tri' },
  channels: {
    p1: `@organ v9 |: ${perChord(chords, STAB)} :|`,
    p2: `@pluck @arp=24 v8 |: ${perChord(chords, ARP)} :|`,
    tri: `@bass v13 |: ${perChord(chords, BASS)} :|`,
    noise: `v7 |: ${bars(chords.map(() => 'K:8 H:8 S:8 H:8 K:8 K:8 S:8 H:8'))} :|`,
  },
};
