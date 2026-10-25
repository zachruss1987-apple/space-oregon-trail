import { describe, expect, it } from 'vitest';
import { defaultHighScores } from '@/sim';
import { professionShort, TOP_TEN_COLS, topTenLines } from '@/scenes/topTenView';
import ui from '../../../src/content/text/ui.json';

describe('Top Ten view (T-040)', () => {
  it('lays the defaults out under topTen.header', () => {
    const header = ui.topTen.header;
    const lines = topTenLines(defaultHighScores());
    expect(lines).toHaveLength(10);
    const starts = TOP_TEN_COLS.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? 0 : acc[i - 1]! + TOP_TEN_COLS[i - 1]! + 1], []);
    for (const word of ['Name', 'Profession', 'Score', 'Days', 'Date']) expect(starts).toContain(header.indexOf(word));
    expect(lines[0]!.startsWith('1.')).toBe(true);
    expect(lines[9]!.startsWith('10.')).toBe(true);
  });
  it('cuts long names and shortens professions', () => {
    const [line] = topTenLines([{ name: 'Bartholomew Quince', profession: 'engineer', score: 1234, days: 140, date: '2184-08-01', difficulty: 'spacer' }]);
    expect(line).toBe('1.  Bartholomew  Engineer    1,234   140   2184-08-01');
    expect(professionShort('executive')).toBe('Executive');
  });
});
