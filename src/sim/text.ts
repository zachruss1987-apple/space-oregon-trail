/** Pure text resolver: pick a writer variant with the rng and fill {placeholders}. */
import { DEATH_TEXT, EVENT_TEXT, STATION_TEXT, TRADE_TEXT, UI_TEXT } from '@/content';
import type { Rng } from './rng';

/** Placeholder values. */
export type TextVars = Readonly<Record<string, string | number>>;

/** Which writer table to read. */
export type TextTable = 'events' | 'deaths' | 'ui' | 'stations' | 'trades';

const TABLES: Record<TextTable, Readonly<Record<string, unknown>>> = {
  events: EVENT_TEXT,
  deaths: DEATH_TEXT,
  ui: UI_TEXT,
  stations: STATION_TEXT,
  trades: TRADE_TEXT,
};

/** Look up `key` directly, then as a dotted path. Returns string variants or null. */
export function lookupVariants(table: TextTable, key: string): readonly string[] | null {
  const root = TABLES[table];
  let node: unknown = root[key];
  if (node === undefined) {
    node = key.split('.').reduce<unknown>(
      (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
      root,
    );
  }
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) {
    const strings = node.filter((v): v is string => typeof v === 'string');
    return strings.length > 0 ? strings : null;
  }
  return null;
}

/** Replace {name}-style placeholders; unknown placeholders are left as-is. */
export function fill(template: string, vars: TextVars = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, k: string) => (k in vars ? String(vars[k]) : whole));
}

/**
 * Resolve one line. Always consumes exactly one rng draw so sim outcomes never depend on how
 * many variants the writer provides. Missing keys fall back to `fallback` (or the key plus vars).
 */
export function resolveText(rng: Rng, table: TextTable, key: string, vars: TextVars = {}, fallback?: string): string {
  const roll = rng.next();
  const variants = lookupVariants(table, key);
  if (!variants) {
    if (fallback !== undefined) return fill(fallback, vars);
    const detail = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(', ');
    return detail ? `${key} (${detail})` : key;
  }
  return fill(variants[Math.floor(roll * variants.length)] as string, vars);
}

/** First variant of a key, filled, with no rng draw (for refusal messages and labels). Missing key → `fallback`. */
export function textLine(table: TextTable, key: string, fallback: string, vars: TextVars = {}): string {
  const variants = lookupVariants(table, key);
  return fill(variants ? (variants[0] as string) : fallback, vars);
}
