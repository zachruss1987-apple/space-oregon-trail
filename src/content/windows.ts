/** Launch windows and weather. Sources: docs/design/world.md, travel.md ("Weather"). */

/** Weather states. */
export type WeatherId = 'calm' | 'fair' | 'unsettled' | 'storm' | 'fog' | 'flare';
/** Launch window number 1–5. */
export type WindowId = 1 | 2 | 3 | 4 | 5;
/** Weather phase by segment. */
export type Phase = 'early' | 'mid' | 'late';

/** Per-weather effects (travel.md weather table). */
export interface WeatherInfo {
  /** Id. */
  id: WeatherId;
  /** Display name. */
  name: string;
  /** Speed factor. */
  speed: number;
  /** Daily health for an unsuited present crew member. */
  healthUnsuited: number;
  /** Daily health for a suited present crew member. */
  healthSuited: number;
  /** Solar storm / Flare day: suit wear and radiation trigger. */
  radiation: boolean;
}

/** Weather effects by id. */
export const WEATHER: Readonly<Record<WeatherId, WeatherInfo>> = {
  calm: { id: 'calm', name: 'Calm', speed: 1.0, healthUnsuited: 0, healthSuited: 0, radiation: false },
  fair: { id: 'fair', name: 'Fair', speed: 1.0, healthUnsuited: 0, healthSuited: 0, radiation: false },
  unsettled: { id: 'unsettled', name: 'Unsettled', speed: 0.9, healthUnsuited: -1, healthSuited: -1, radiation: false },
  storm: { id: 'storm', name: 'Solar storm', speed: 0.6, healthUnsuited: -3, healthSuited: -1, radiation: true },
  fog: { id: 'fog', name: 'Ion fog', speed: 0.7, healthUnsuited: 0, healthSuited: 0, radiation: false },
  flare: { id: 'flare', name: 'Flare', speed: 0.5, healthUnsuited: -5, healthSuited: -2, radiation: true },
};

/** Column order of the weather rows. */
export const WEATHER_ORDER: readonly WeatherId[] = ['calm', 'fair', 'unsettled', 'storm', 'fog', 'flare'];

/** A weather row: percentage weights in WEATHER_ORDER. */
export type WeatherRow = readonly [number, number, number, number, number, number];

/** Probability tomorrow keeps today's weather. */
export const WEATHER_PERSISTENCE = 0.6;
/** Weather on day 0. */
export const INITIAL_WEATHER: WeatherId = 'fair';
/** Segments (state.segment) where each phase applies; late is the only Flare phase. */
export const PHASE_SEGMENTS = { early: [1, 5], mid: [6, 13], late: [14, 16] } as const;

/** Mid-phase row (all windows). */
export const MID_ROW: WeatherRow = [15, 45, 20, 10, 10, 0];
/** Late-phase rows by flare season. */
export const LATE_ROWS: Readonly<{ before: WeatherRow; flareSeason: WeatherRow }> = {
  before: [10, 40, 20, 10, 10, 10],
  flareSeason: [5, 20, 20, 10, 5, 40],
};

/** First day of flare season (ISO date); it does not end within a run. */
export const FLARE_SEASON_START = '2184-09-15';

/** A launch window. */
export interface LaunchWindow {
  /** 1–5. */
  id: WindowId;
  /** Calendar start, ISO date. */
  start: string;
  /** Display label. */
  label: string;
  /** Early weather label. */
  earlyWeather: string;
  /** Late-trail risk label. */
  lateRisk: string;
  /** Early-phase weather row. */
  earlyRow: WeatherRow;
  /** Incident-chance bonus (percentage points) at the listed hazard waypoint ids. */
  hazardBonus: number;
  /** Waypoint ids the hazard bonus applies to. */
  hazardBonusAt: readonly string[];
}

const SPRING_TIDES = ['lunar-debris-ring', 'lagrange-shoals'] as const;

/** The five launch windows. */
export const WINDOWS: Readonly<Record<WindowId, LaunchWindow>> = {
  1: { id: 1, start: '2184-03-01', label: '1 March 2184', earlyWeather: 'Stormy (solar max tail)', lateRisk: 'Low', earlyRow: [5, 25, 30, 30, 10, 0], hazardBonus: 10, hazardBonusAt: SPRING_TIDES },
  2: { id: 2, start: '2184-04-01', label: '1 April 2184', earlyWeather: 'Unsettled', lateRisk: 'Low', earlyRow: [10, 35, 30, 15, 10, 0], hazardBonus: 5, hazardBonusAt: SPRING_TIDES },
  3: { id: 3, start: '2184-05-01', label: '1 May 2184', earlyWeather: 'Fair', lateRisk: 'Medium', earlyRow: [15, 50, 20, 8, 7, 0], hazardBonus: 0, hazardBonusAt: [] },
  4: { id: 4, start: '2184-06-01', label: '1 June 2184', earlyWeather: 'Fair', lateRisk: 'High', earlyRow: [20, 50, 18, 6, 6, 0], hazardBonus: 0, hazardBonusAt: [] },
  5: { id: 5, start: '2184-07-01', label: '1 July 2184', earlyWeather: 'Calm', lateRisk: 'Very high (flare season on arrival)', earlyRow: [35, 45, 12, 4, 4, 0], hazardBonus: 0, hazardBonusAt: [] },
};

/** Window ids in order. */
export const WINDOW_ORDER: readonly WindowId[] = [1, 2, 3, 4, 5];
