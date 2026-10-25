/**
 * Key hints bar logic (keyhints.md): platform detection, per-platform key names, `"Key|Label"` parsing, the fit rule,
 * and the tiny store the KeyRouter publishes the current set id to. Pure: no Phaser, no DOM, runs under Vitest.
 */

export type Platform = 'touch' | 'mac' | 'windows' | 'linux';
export const PLATFORMS: readonly Platform[] = ['touch', 'mac', 'windows', 'linux'];

/** What `detectPlatform` reads from the browser (main thread passes navigator / matchMedia values). */
export interface PlatformEnv {
  userAgent: string;
  /** `navigator.userAgentData?.platform`, or ''. */
  uaPlatform: string;
  /** `matchMedia('(pointer: coarse)').matches`. */
  coarsePointer: boolean;
}

/** `?platform=mac|windows|linux|touch` (debug and tests only), else null. */
export function platformOverride(search: string): Platform | null {
  const v = new URLSearchParams(search).get('platform')?.toLowerCase() ?? '';
  return (PLATFORMS as readonly string[]).includes(v) ? (v as Platform) : null;
}

/** Touch, then Mac, then Windows, else Linux (keyhints.md "Platform detection"); `search` may carry the override. */
export function detectPlatform(env: PlatformEnv, search = ''): Platform {
  const forced = platformOverride(search);
  if (forced) return forced;
  if (env.coarsePointer || /Android|iPhone|iPad|iPod|Mobile/i.test(env.userAgent)) return 'touch';
  // userAgentData says "macOS" / "Windows"; the UA string says "Macintosh" / "Windows NT".
  if (/mac/i.test(env.uaPlatform) || /Mac/.test(env.userAgent)) return 'mac';
  if (/windows/i.test(env.uaPlatform) || /Windows/.test(env.userAgent)) return 'windows';
  return 'linux';
}

const MAC_NAMES: Readonly<Record<string, string>> = { Enter: 'Return', Backspace: 'Delete' };

/** The key as the player's platform names it (Enter -> Return, Backspace -> Delete on a Mac). */
export function keyLabel(name: string, platform: Platform): string {
  return platform === 'mac' ? (MAC_NAMES[name] ?? name) : name;
}

/** Canonical key names allowed in `hints.*` (besides single letters/digits and digit ranges like `1-9`). */
export const CANONICAL_KEYS: readonly string[] = [
  'Enter', 'Backspace', 'Esc', 'Space', 'Tab', 'Shift+1', 'Arrows', 'Up/Down', 'Left/Right', 'A-Z', '?', 'Any key',
];

export const isCanonicalKey = (k: string): boolean => CANONICAL_KEYS.includes(k) || /^[A-Z0-9]$/.test(k) || /^\d-\d$/.test(k);

export interface Hint {
  key: string;
  label: string;
}

/** One `"Key|Label"` entry, or null when it does not have exactly one `|` with text on both sides. */
export function parseHint(entry: unknown): Hint | null {
  if (typeof entry !== 'string') return null;
  const parts = entry.split('|');
  if (parts.length !== 2) return null;
  const [key, label] = parts.map((p) => p.trim()) as [string, string];
  return key && label ? { key, label } : null;
}

/** A `hints.<id>` array; malformed entries are skipped. */
export function parseHintSet(entries: unknown): Hint[] {
  if (!Array.isArray(entries)) return [];
  return entries.map(parseHint).filter((h): h is Hint => h !== null);
}

/** Text budget in px (640 minus 8 px margins) and the glyph cell. */
export const HINT_BUDGET_PX = 624;
export const HINT_GLYPH_W = 8;
export const HINT_LEFT_X = 8;
/** Characters between groups. */
export const HINT_GAP = 2;

/** One drawn group: `[Key]` at x, then ` Label`. */
export interface PlacedHint {
  key: string;
  label: string;
  x: number;
}

/** `[Key] Label` with the key in its platform name. */
export const groupText = (h: Hint, platform: Platform): string => `[${keyLabel(h.key, platform)}] ${h.label}`;

/**
 * Lay out a set left-aligned from x = 8 with two spaces between groups and `help` (the `[?] Help` group, or null)
 * right-aligned at the end of the budget. Pairs drop from the end of the set until everything fits; help never drops.
 */
export function fitHints(set: readonly Hint[], help: Hint | null, platform: Platform, budget = HINT_BUDGET_PX): { left: PlacedHint[]; help: PlacedHint | null } {
  const w = (h: Hint): number => groupText(h, platform).length * HINT_GLYPH_W;
  const helpW = help ? w(help) : 0;
  const reserve = help ? helpW + HINT_GAP * HINT_GLYPH_W : 0;
  let n = set.length;
  const widthOf = (k: number): number => set.slice(0, k).reduce((sum, h, i) => sum + w(h) + (i > 0 ? HINT_GAP * HINT_GLYPH_W : 0), 0);
  while (n > 0 && widthOf(n) + reserve > budget) n -= 1;
  const left: PlacedHint[] = [];
  let x = HINT_LEFT_X;
  for (const h of set.slice(0, n)) {
    left.push({ key: keyLabel(h.key, platform), label: h.label, x });
    x += w(h) + HINT_GAP * HINT_GLYPH_W;
  }
  const placedHelp = help ? { key: keyLabel(help.key, platform), label: help.label, x: HINT_LEFT_X + budget - helpW } : null;
  return { left, help: placedHelp };
}

/** Key hints option (Options row "Key hints"): Auto hides them on touch platforms. */
export function hintsShown(option: 'auto' | 'on' | 'off', platform: Platform): boolean {
  return option === 'on' || (option === 'auto' && platform !== 'touch');
}

/** What the router last published: the set id and whether a typing field has focus. */
export interface HintState {
  id: string;
  textEntry: boolean;
}

type Listener = (s: HintState) => void;
const store: { state: HintState; listeners: Set<Listener> } = { state: { id: 'none', textEntry: false }, listeners: new Set() };

/** Publish a new hint state (KeyRouter). */
export function publishHints(id: string, textEntry = false): void {
  store.state = { id, textEntry };
  store.listeners.forEach((l) => l(store.state));
}

export const currentHints = (): HintState => store.state;

/** Subscribe; returns the unsubscribe function. */
export function onHints(l: Listener): () => void {
  store.listeners.add(l);
  return () => store.listeners.delete(l);
}
