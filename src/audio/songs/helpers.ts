/** Small string builders for song data (bars of chords, bass, rests). */

export const bars = (b: string[]): string => b.join(' | ');
/** `n` bars of rest in 3/4 (`beats` = 3) or 4/4. */
export const restBars = (n: number, beats = 3): string => bars(Array.from({ length: n }, () => (beats === 3 ? 'r:2.' : 'r:1')));

/** Chord symbol -> arpeggio note names (octave 4). */
const CHORD_TONES: Record<string, string> = {
  D: 'D4 F#4 A4',
  G: 'D4 G4 B4',
  A: 'E4 A4 C#5',
  Bm: 'D4 F#4 B4',
  Em: 'E4 G4 B4',
};
/** Root and fifth for a bass line. */
const CHORD_BASS: Record<string, [string, string]> = {
  D: ['D2', 'A2'],
  G: ['G2', 'D3'],
  A: ['A2', 'E3'],
  Bm: ['B2', 'F#3'],
  Em: ['E2', 'B2'],
};

/** One 3/4 bar of arpeggio per chord. */
export const arpBars = (chords: string[]): string => bars(chords.map((c) => `[${CHORD_TONES[c] as string}]:2.`));
/** One 3/4 bar of root-fifth-fifth per chord. */
export const bassBars = (chords: string[]): string =>
  bars(
    chords.map((c) => {
      const [r, f] = CHORD_BASS[c] as [string, string];
      return `${r}:4 ${f}:4 ${f}:4`;
    }),
  );
