/** Pure view helpers for the Top Ten table (columns laid out under `topTen.header`). */
import { PROFESSIONS } from '@/content';
import type { HighScore } from '@/sim';
import { col, fmt } from '@/ui/theme';

/** Column widths matching "No. Name         Profession  Score   Days  Date" (one space between columns). */
export const TOP_TEN_COLS = [3, 12, 11, 7, 5, 10] as const;

/** Last word of a profession name ("Ship Engineer" -> "Engineer"). */
export function professionShort(id: string): string {
  const name = PROFESSIONS[id as keyof typeof PROFESSIONS]?.name ?? id;
  return name.split(' ').pop() ?? name;
}

/** One table line per score, left-aligned under the header: rank, name (cut to fit), profession, score, days, date. */
export function topTenLines(list: readonly HighScore[]): string[] {
  return list.map((h, i) => {
    const cells = [`${i + 1}.`, h.name.slice(0, TOP_TEN_COLS[1]), professionShort(h.profession), fmt(h.score), String(h.days), h.date];
    return cells.map((c, j) => col(c, TOP_TEN_COLS[j]!)).join(' ').trimEnd();
  });
}
