/** docs/design/scoring.md: score lines, bonuses, multipliers and ratings. */
import { describe, expect, it } from 'vitest';
import { computeScore, ratingFor, type GameState, type ProfessionId, type ScoreBreakdown, type Supplies } from '@/sim';
import { ship, withCrew } from './spec-helpers';

type Over = { supplies?: Partial<Supplies>; credits?: number; date?: string; deaths?: number; profession?: ProfessionId; health?: number[] };

/** An arrived ship with everything at zero unless overridden (five Good crew, no deaths, arrived 1 June). A health of 0 means dead. */
function arrived(o: Over = {}): GameState {
  const s = ship({
    status: 'arrived', credits: o.credits ?? 0, date: o.date ?? '2184-06-01', deaths: o.deaths ?? 0, segment: 16, arrivedAt: 16,
    supplies: { drives: 0, rations: 0, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0, ...o.supplies },
  }, o.profession ?? 'executive');
  const health = o.health ?? [100, 100, 100, 100, 100];
  return { ...s, crew: s.crew.map((c, i) => ({ ...c, health: health[i]!, alive: health[i]! > 0 })) };
}
const line = (b: ScoreBreakdown, key: string): number => b.lines.find((l) => l.key === key)?.points ?? 0;

describe('Score lines (scoring.md table)', () => {
  it.each([[100, 500], [75, 500], [74, 400], [50, 400], [49, 300], [25, 300], [24, 200], [1, 200]])('a survivor at health %i is worth %i', (h, pts) => {
    expect(line(computeScore(arrived({ health: [h, 0, 0, 0, 0] })), 'crew')).toBe(pts);
  });

  it('each surviving crew member counts; dead crew do not', () => {
    expect(line(computeScore(arrived({ health: [100, 100, 100, 0, 0] })), 'crew')).toBe(1500);
  });

  it('missing (drifting) crew who are alive count as survivors (they rejoin on arrival)', () => {
    expect(line(computeScore(withCrew(arrived(), 4, { awayDays: 3 })), 'crew')).toBe(2500);
  });

  it('the ship is worth 50', () => {
    expect(line(computeScore(arrived()), 'ship')).toBe(50);
  });

  it('each ion drive owned is 4 (offline drives count)', () => {
    const s = { ...arrived({ supplies: { drives: 4 } }), offlineDrives: [2] };
    expect(line(computeScore(s), 'drives')).toBe(16);
  });

  it('each spare part in the hold is 2, max 3 per type', () => {
    expect(line(computeScore(arrived({ supplies: { plates: 1, pumps: 2, gyros: 3 } })), 'spares')).toBe(12);
    expect(line(computeScore(arrived({ supplies: { plates: 7, pumps: 0, gyros: 0 } })), 'spares')).toBe(6);
  });

  it('each EVA suit is 2', () => {
    expect(line(computeScore(arrived({ supplies: { suits: 7 } })), 'suits')).toBe(14);
  });

  it.each([[49, 0], [50, 1], [80, 1], [99, 1], [100, 2]])('%i drone charges are %i points (1 per 50)', (c, pts) => {
    expect(line(computeScore(arrived({ supplies: { charges: c } })), 'charges')).toBe(pts);
  });

  it.each([[24, 0], [25, 1], [120, 4], [2250, 90]])('%i rations are %i points (1 per 25 ration-days)', (r, pts) => {
    expect(line(computeScore(arrived({ supplies: { rations: r } })), 'rations')).toBe(pts);
  });

  it.each([[4.99, 0], [5, 1], [370, 74], [0.3, 0]])('%f credits are %i points (1 per 5 cr, floored)', (c, pts) => {
    expect(line(computeScore(arrived({ credits: c })), 'credits')).toBe(pts);
  });

  it('the subtotal is the sum of the lines (bonuses included) and the total is subtotal x multiplier', () => {
    const b = computeScore(arrived({ supplies: { drives: 3, suits: 5, rations: 100 }, credits: 50, profession: 'engineer' }));
    expect(b.subtotal).toBe(b.lines.reduce((a, l) => a + l.points, 0));
    expect(b.total).toBe(b.subtotal * 2);
  });
});

describe('Bonuses (scoring.md)', () => {
  it('arrival before 15 September 2184 earns +200', () => {
    expect(line(computeScore(arrived({ date: '2184-09-14' })), 'flareBonus')).toBe(200);
  });

  it('arrival on or after 15 September earns no flare bonus', () => {
    expect(line(computeScore(arrived({ date: '2184-09-15' })), 'flareBonus')).toBe(0);
    expect(line(computeScore(arrived({ date: '2184-11-02' })), 'flareBonus')).toBe(0);
  });

  it('zero crew deaths earns +300', () => {
    expect(line(computeScore(arrived({ deaths: 0 })), 'noDeathsBonus')).toBe(300);
  });

  it('any death (including drift losses, which are counted in deaths) forfeits the +300', () => {
    expect(line(computeScore(arrived({ deaths: 1 })), 'noDeathsBonus')).toBe(0);
  });

  it('bonuses are added before the multiplier', () => {
    const e = computeScore(arrived({ profession: 'executive' }));
    const f = computeScore(arrived({ profession: 'farmer' }));
    expect(e.subtotal).toBe(2500 + 50 + 200 + 300);
    expect(f.subtotal).toBe(e.subtotal);
    expect(f.total).toBe(e.total * 3);
  });
});

describe('Multipliers and ratings', () => {
  it.each([['executive', 1], ['engineer', 2], ['farmer', 3]] as const)('%s multiplier is x%i', (p, m) => {
    expect(computeScore(arrived({ profession: p })).multiplier).toBe(m);
  });

  it.each([[6000, 'Pathfinder'], [5999, 'Spacer'], [3000, 'Spacer'], [2999, 'Groundling'], [0, 'Groundling'], [10000, 'Pathfinder']])('score %i is %s', (n, title) => {
    expect(ratingFor(n)).toBe(title);
  });

  it('the breakdown reports the rating of its total', () => {
    const b = computeScore(arrived({ profession: 'farmer' }));
    expect(b.rating).toBe(ratingFor(b.total));
  });

  it('worked example: Engineer, 4 survivors (Good, Good, Fair, Poor), 3 drives, 2 spares, 7 suits, 80 charges, 120 rations, arrived 2 Sept = 3,970 Spacer', () => {
    const b = computeScore(arrived({
      profession: 'engineer', deaths: 1, date: '2184-09-02', credits: 0,
      supplies: { drives: 3, plates: 1, pumps: 1, gyros: 0, suits: 7, charges: 80, rations: 120 },
      health: [90, 80, 60, 30, 0],
    }));
    expect(line(b, 'crew')).toBe(1700);
    expect(line(b, 'drives')).toBe(12);
    expect(line(b, 'spares')).toBe(4);
    expect(line(b, 'suits')).toBe(14);
    expect(line(b, 'charges')).toBe(1);
    expect(line(b, 'rations')).toBe(4);
    expect(b.subtotal).toBe(1985);
    expect(b.total).toBe(3970);
    expect(b.rating).toBe('Spacer');
  });

  it('death endings show no score (no living crew -> 0)', () => {
    expect(computeScore(arrived({ health: [0, 0, 0, 0, 0] })).total).toBe(0);
  });
});
