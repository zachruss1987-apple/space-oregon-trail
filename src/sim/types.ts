/** Simulation types. Pure data; JSON-serializable. */
import type {
  ConditionId, DeathCause, EventId, FairnessId, PartId, ProfessionId, RationId, RouteId, SupplyKey, ThrustId, TradeGood, WeatherId, WindowId,
} from '@/content';

export type {
  ConditionId, DeathCause, EventId, FairnessId, PartId, ProfessionId, RationId, RouteId, SupplyKey, ThrustId, TradeGood, WeatherId, WindowId,
};

/** Save format version for serialize.ts. */
export const STATE_VERSION = 2;

/** One active condition on a crew member. */
export interface ActiveCondition {
  /** Condition id. */
  id: ConditionId;
  /** Days remaining (exhaustion: non-Overburn ticks still needed). */
  remaining: number;
  /** Days it has been active (progress steps applied). */
  daysActive: number;
}

/** A crew member. crew[0] is the captain. */
export interface Crew {
  /** Display name. */
  name: string;
  /** 0–100 integer. */
  health: number;
  /** Max 2, no duplicates. */
  conditions: ActiveCondition[];
  /** > 0 while drifting (not present). */
  awayDays: number;
  /** False once dead. */
  alive: boolean;
  /** Death cause, set on death. */
  cause: DeathCause | null;
  /** Day of death, set on death. */
  diedOnDay: number | null;
}

/** Hold inventory, integer units. */
export type Supplies = Record<SupplyKey, number>;

/** Installed parts' broken flags. */
export type Broken = Record<PartId, boolean>;

/** Run status. */
export type Status = 'store' | 'traveling' | 'arrived' | 'dead' | 'adrift';

/** Log entry kinds the UI and tests can switch on. */
export type LogKind =
  | 'depart' | 'store' | 'travel' | 'weather' | 'help' | 'starving' | 'suit' | 'condition' | 'recover'
  | 'death' | 'rejoin' | 'event' | 'quiet' | 'arrival' | 'hazard' | 'rest' | 'repair' | 'scan' | 'setting'
  | 'gameover' | 'info' | 'crossing' | 'route' | 'trade';

/** One structured log line. */
export interface LogEntry {
  /** Day it happened. */
  day: number;
  /** Category. */
  kind: LogKind;
  /** Rendered text (writer copy, or the key as fallback). */
  text: string;
  /** Specific id: event id, condition id, death cause, waypoint id, part, etc. */
  id?: string;
}

/** Crossing methods (hazards.md). */
export type CrossMethod = 'thread' | 'shields' | 'tug' | 'pilot';

/** A pending hazard crossing: set on hazard arrival, null once resolved. */
export interface Crossing {
  /** Hazard waypoint index. */
  waypoint: number;
  /** Today's density 1–5 (rolled on arrival). */
  density: number;
  /** Pilot wait days still to run; null until a pilot is sent for. */
  pilotDaysLeft: number | null;
}

/** One side of a trade: an item (or credits) and a quantity in units (charges: single charges). */
export interface TradeLot {
  /** Supply key or credits. */
  item: TradeGood;
  /** Units. */
  qty: number;
}

/** An NPC barter offer at a road station (economy.md). */
export interface TradeOffer {
  /** Persona id in trades.json. */
  persona: string;
  /** What the player hands over. */
  give: TradeLot;
  /** What the player receives (never credits). */
  get: { item: SupplyKey; qty: number };
  /** Hidden fairness roll (tests only; never shown). */
  fairness: FairnessId;
  /** True once accepted (accept-once). */
  taken: boolean;
}

/** A road-station visit: set on arrival at a road station, null on departure. */
export interface StationVisit {
  /** Station waypoint index. */
  waypoint: number;
  /** 0–3 offers, kept for the whole visit. */
  offers: TradeOffer[];
}

/** Full game state. */
export interface GameState {
  /** Save version. */
  version: number;
  /** Chosen profession. */
  profession: ProfessionId;
  /** Chosen launch window. */
  window: WindowId;
  /** Five crew members. */
  crew: Crew[];
  /** Credits (may hold cents from ration purchases). */
  credits: number;
  /** Hold inventory. */
  supplies: Supplies;
  /** Installed part flags. */
  broken: Broken;
  /** Remaining offline days per stalled drive. */
  offlineDrives: number[];
  /** Calendar date, ISO YYYY-MM-DD. */
  date: string;
  /** Days elapsed since departure setup (0 at start). */
  day: number;
  /** Index of the next waypoint (1–16). */
  segment: number;
  /** Mk covered in the current segment. */
  distanceInSegment: number;
  /** Mk covered in total. */
  distanceTotal: number;
  /** Thrust setting. */
  thrust: ThrustId;
  /** Ration setting. */
  rations: RationId;
  /** Today's weather. */
  weather: WeatherId;
  /** Pending delay days (distance 0). */
  delayDays: number;
  /** Consecutive days with 0 drives. */
  strandedDays: number;
  /** Consecutive Overburn moving days. */
  consecutiveOverburn: number;
  /** Consecutive days on Half or Paste. */
  consecutiveLowRations: number;
  /** Loss events filtered while day < this. */
  eventCooldownUntilDay: number;
  /** Dysentery weight ×3 while day ≤ this (bad_recycler). */
  badRecyclerUntilDay: number;
  /** Scans done since the last waypoint. */
  scansThisSegment: number;
  /** Set on hazard arrival; enables cargo_shift on the first tick after leaving. */
  justCrossedHazard: boolean;
  /** Waypoint index the ship is parked at (null while between waypoints). */
  arrivedAt: number | null;
  /** Crew deaths so far (drift counts). */
  deaths: number;
  /** Event and day log, oldest first. */
  log: LogEntry[];
  /** Run status. */
  status: Status;
  /** Pending hazard crossing (UI must show the Hazard scene while non-null). */
  crossing: Crossing | null;
  /** Route past Titan Refinery. */
  route: RouteId;
  /** Current road-station visit (Station scene available while non-null). */
  station: StationVisit | null;
}

/** Options for createGame. */
export interface NewGameOptions {
  /** Profession. */
  profession: ProfessionId;
  /** Up to five names; missing/invalid entries fall back to defaults. */
  crewNames?: readonly string[];
  /** Launch window. */
  window: WindowId;
}

/** What a day is spent on. */
export type DayKind =
  | { kind: 'travel' }
  | { kind: 'rest' }
  | { kind: 'scan' }
  | { kind: 'repair'; part: PartId }
  | { kind: 'wait' };

/** Player intents for applyAction. */
export type Intent =
  | { type: 'continue' }
  | { type: 'rest'; days: number }
  | { type: 'setThrust'; thrust: ThrustId }
  | { type: 'setRations'; rations: RationId }
  | { type: 'repair'; part: PartId }
  | { type: 'scan' }
  | { type: 'cross'; method: CrossMethod }
  | { type: 'route'; via: RouteId }
  | { type: 'buy'; item: SupplyKey; packs: number }
  | { type: 'sell'; item: SupplyKey; packs: number }
  | { type: 'trade'; offer: number };

/** Result of tick/applyAction: the new state and the entries appended this call. */
export interface StepResult {
  /** New state (input is never mutated). */
  state: GameState;
  /** Log entries produced by this step (also appended to state.log). */
  entries: LogEntry[];
  /** Set when the intent was refused (no day passed). */
  error?: string;
}
