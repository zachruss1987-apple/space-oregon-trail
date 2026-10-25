/** Sticky weather Markov chain (travel.md "Weather Markov chain"). */
import {
  LATE_ROWS, MID_ROW, PHASE_SEGMENTS, WEATHER_ORDER, WEATHER_PERSISTENCE, WINDOWS,
  type Phase, type WeatherId, type WeatherRow, type WindowId,
} from '@/content';
import type { Rng } from './rng';
import { isFlareSeason } from './util';

/** Phase for a segment index (state.segment). */
export function phaseFor(segment: number): Phase {
  if (segment <= PHASE_SEGMENTS.early[1]) return 'early';
  if (segment <= PHASE_SEGMENTS.mid[1]) return 'mid';
  return 'late';
}

/** The weight row in force for this window, segment and date. */
export function weatherRow(window: WindowId, segment: number, date: string): WeatherRow {
  const phase = phaseFor(segment);
  if (phase === 'early') return WINDOWS[window].earlyRow;
  if (phase === 'mid') return MID_ROW;
  return isFlareSeason(date) ? LATE_ROWS.flareSeason : LATE_ROWS.before;
}

/** Is this weather possible under the row (Flare only in the late phase)? */
export function allowedIn(weather: WeatherId, row: WeatherRow): boolean {
  return row[WEATHER_ORDER.indexOf(weather)]! > 0;
}

/** Draw from a row. */
export function drawWeather(rng: Rng, row: WeatherRow): WeatherId {
  return rng.weighted(WEATHER_ORDER.map((item, i) => ({ item, weight: row[i]! })));
}

/** Tomorrow's weather: keep today's with p = 0.6 if still allowed, else draw from the row. */
export function nextWeather(rng: Rng, today: WeatherId, window: WindowId, segment: number, date: string): WeatherId {
  const row = weatherRow(window, segment, date);
  const keep = rng.chance(WEATHER_PERSISTENCE);
  if (keep && allowedIn(today, row)) return today;
  return drawWeather(rng, row);
}
