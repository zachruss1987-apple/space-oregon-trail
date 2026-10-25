/** `title`: hopeful frontier homage. D major, 3/4, 116 BPM; 2 bars intro + 32 bar loop. Original melody. */
import type { SongDef } from '../types';
import { arpBars, bars, bassBars, restBars } from './helpers';

const A = [
  'D5:4 F#5:8 A5:8 F#5:4',
  'E5:4 D5:8 B4:8 A4:4',
  'B4:4 D5:8 E5:8 D5:4',
  'A4:8 B4:8 A4:8 F#4:8 A4:4', // fiddle-style turn around the 5th
  'D5:4 F#5:8 A5:8 B5:4',
  'A5:8 F#5:8 E5:8 D5:8 E5:4',
  'F#5:4 E5:4 D5:4',
  'D5:2.',
];
const A2 = [...A.slice(0, 4), 'D5:4 A5:8 F#5:8 A5:4', 'B5:4 A5:8 F#5:8 E5:4', 'E5:8 F#5:8 E5:8 C#5:8 E5:4', 'A4:2.'];
const B = [
  'B4:4 D5:4 F#5:4',
  'E5:4 D5:4 B4:4',
  'D5:4 G5:8 F#5:8 D5:4',
  'B4:4 D5:4 G4:4',
  'G5:4 E5:8 G5:8 B5:4',
  'A5:4 F#5:4 E5:4',
  'D5:4 F#5:8 E5:8 D5:4',
  'C#5:4 E5:4 A4:4',
];
const A3 = [...A.slice(0, 7), 'D5:4 A4:4 F#4:4'];

const chordsA = ['D', 'D', 'G', 'D', 'D', 'G', 'A', 'D'];
const chordsA2 = ['D', 'D', 'G', 'D', 'D', 'G', 'A', 'A'];
const chordsB = ['Bm', 'Bm', 'G', 'G', 'Em', 'A', 'Bm', 'A'];
const loopChords = [...chordsA, ...chordsA2, ...chordsB, ...chordsA];

export const title: SongDef = {
  id: 'title',
  tempo: 116,
  meter: [3, 4],
  voices: { p1: 'p25', p2: 'p12', tri: 'tri' },
  channels: {
    p1: `@lead v12 ${bars(['D4:4 F#4:4 A4:4', 'D5:2.'])} | |: ${bars([...A, ...A2, ...B, ...A3])} :|`,
    p2: `@pluck @arp=12 v8 ${restBars(2)} | |: ${arpBars(loopChords)} :|`,
    tri: `@bass v13 ${bassBars(['D', 'D'])} | |: ${bassBars(loopChords)} :|`,
    noise: `v6 ${restBars(2)} | |: ${bars(loopChords.map(() => 'K:4 H:4 H:4'))} :|`,
  },
};
