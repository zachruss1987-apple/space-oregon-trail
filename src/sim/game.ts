/** New game creation (docs/design/world.md "New game (initial state)"). */
import {
  CREW_SIZE, DEFAULT_CREW_NAMES, INITIAL_WEATHER, NAME_MAX_LENGTH, NAME_MIN_LENGTH, NAME_POOL, PROFESSIONS, WINDOWS,
} from '@/content';
import type { Rng } from './rng';
import { resolveText } from './text';
import { STATE_VERSION, type Crew, type GameState, type NewGameOptions } from './types';

/** True for 1–12 printable ASCII characters (after trimming). */
export function isValidName(name: string): boolean {
  const t = name.trim();
  return t.length >= NAME_MIN_LENGTH && t.length <= NAME_MAX_LENGTH && /^[\x20-\x7e]+$/.test(t);
}

/** Five names: each invalid/missing entry reverts to its default. */
export function normalizeCrewNames(names: readonly string[] = []): string[] {
  return DEFAULT_CREW_NAMES.slice(0, CREW_SIZE).map((def, i) => {
    const n = names[i];
    return n !== undefined && isValidName(n) ? n.trim() : def;
  });
}

/** Five distinct names drawn from the pool ("Random names"). */
export function randomCrewNames(rng: Rng): string[] {
  const pool = [...NAME_POOL];
  const out: string[] = [];
  while (out.length < CREW_SIZE) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0] as string);
  return out;
}

function newCrew(name: string): Crew {
  return { name, health: 100, conditions: [], awayDays: 0, alive: true, cause: null, diedOnDay: null };
}

/** Build the initial state, parked at Independence Station in the store. */
export function createGame(options: NewGameOptions, rng: Rng): GameState {
  const profession = PROFESSIONS[options.profession];
  const window = WINDOWS[options.window];
  if (!profession) throw new Error(`Unknown profession: ${String(options.profession)}`);
  if (!window) throw new Error(`Unknown window: ${String(options.window)}`);
  const state: GameState = {
    version: STATE_VERSION,
    profession: profession.id,
    window: window.id,
    crew: normalizeCrewNames(options.crewNames).map(newCrew),
    credits: profession.credits,
    supplies: { drives: 0, rations: 0, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0 },
    broken: { hull: false, pump: false, gyro: false },
    offlineDrives: [],
    date: window.start,
    day: 0,
    segment: 1,
    distanceInSegment: 0,
    distanceTotal: 0,
    thrust: 'cruise',
    rations: 'full',
    weather: INITIAL_WEATHER,
    delayDays: 0,
    strandedDays: 0,
    consecutiveOverburn: 0,
    consecutiveLowRations: 0,
    eventCooldownUntilDay: 0,
    badRecyclerUntilDay: -1,
    scansThisSegment: 0,
    justCrossedHazard: false,
    arrivedAt: null,
    deaths: 0,
    log: [],
    status: 'store',
    crossing: null,
    route: 'oort',
    station: null,
    seed: typeof options.seed === 'string' ? options.seed : '',
    rodeTheWind: false,
  };
  const text = resolveText(rng, 'ui', 'log.departure', { name: state.crew[0]!.name },
    `Captain {name} and crew make ready at Independence Station, ${window.label}.`);
  state.log.push({ day: 0, kind: 'depart', text });
  return state;
}
