import type { ProfessionId, WindowId } from '@/content';
import { createGame } from '@/sim/game';
import { newDayContext, type DayContext } from '@/sim/health';
import { createRng, type Rng } from '@/sim/rng';
import type { GameState, LogEntry, Supplies } from '@/sim/types';

/** An Rng whose next() replays `values` (then 0.5). int/chance/pick/weighted derive from next() like the real one. */
export function scriptedRng(values: number[]): Rng {
  const base = createRng(1);
  const queue = [...values];
  const next = (): number => (queue.length ? (queue.shift() as number) : 0.5);
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) return base.pick(items);
      return items[Math.floor(next() * items.length)]!;
    },
    weighted: (items) => {
      const total = items.reduce((s, i) => s + i.weight, 0);
      let r = next() * total;
      for (const i of items) {
        r -= i.weight;
        if (r < 0) return i.item;
      }
      return items[items.length - 1]!.item;
    },
  };
}

/** Rng that always returns `v`. */
export function constRng(v: number): Rng {
  return scriptedRng(new Array(10000).fill(v));
}

/** A traveling state with a sensible kit; override anything. */
export function travelingState(
  over: Partial<Omit<GameState, 'supplies'>> & { supplies?: Partial<Supplies> } = {},
  profession: ProfessionId = 'executive',
  window: WindowId = 3,
): GameState {
  const s = createGame({ profession, window }, createRng(7));
  s.status = 'traveling';
  s.supplies = { drives: 3, rations: 1500, suits: 10, charges: 100, plates: 1, pumps: 1, gyros: 1 };
  const { supplies, ...rest } = over;
  Object.assign(s, rest);
  Object.assign(s.supplies, supplies ?? {});
  return s;
}

/** A context plus log collector. */
export function ctxAndLog(partial: Partial<DayContext> = {}): { ctx: DayContext; out: LogEntry[] } {
  return { ctx: newDayContext(partial), out: [] };
}
