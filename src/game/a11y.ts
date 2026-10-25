/**
 * Screen-reader mirror (ui.md "Accessibility"): the Phaser canvas is opaque to assistive tech, so two visually hidden
 * DOM nodes carry what the screen shows.
 * - `#proxima-live` (`role="log"`, `aria-live="polite"`): every new log line, modal text, panel and notice, one `<p>` each.
 * - `#proxima-menu` (`role="listbox"`): the topmost live menu's rows as `role="option"`, the selected one
 *   `aria-selected="true"`, disabled ones `aria-disabled="true"` with their reason in the text.
 * The DOM is injectable (`A11yDocument`) so the module runs under Vitest's node environment with a fake.
 */

/** The slice of a DOM element this module touches. */
export interface A11yElement {
  id: string;
  textContent: string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  appendChild(child: A11yElement): unknown;
  removeChild(child: A11yElement): unknown;
  readonly firstChild: unknown;
  readonly childElementCount: number;
}

/** The slice of `Document` this module touches. */
export interface A11yDocument {
  getElementById(id: string): A11yElement | null;
  createElement(tag: string): A11yElement;
  readonly body: { appendChild(child: A11yElement): unknown };
}

/** One menu row as the listbox shows it. */
export interface A11yItem {
  label: string;
  /** Reason the row cannot be chosen (null/undefined = enabled). */
  disabled?: string | null;
}

/** A menu the listbox can mirror (src/ui/Menu registers itself). */
export interface A11yMenu {
  items(): readonly A11yItem[];
  readonly cursor: number;
  /** False once the menu's objects are gone (a scene wiped its children without calling destroy). */
  alive(): boolean;
}

export const LIVE_ID = 'proxima-live';
export const MENU_ID = 'proxima-menu';
/** Lines kept in the live region (older ones are dropped). */
export const LIVE_MAX = 40;
/** Visually hidden but in the accessibility tree (the usual sr-only clip). */
const SR_ONLY = 'position:absolute;left:0;top:0;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';
/** With `dedupe`, a line identical to one of this many recent ones is not repeated (log entry, then its modal). */
const DEDUPE = 6;

let doc: A11yDocument | null = null;
const menus: A11yMenu[] = [];
const recent: string[] = [];

const defaultDoc = (): A11yDocument | null => (typeof document === 'undefined' ? null : (document as unknown as A11yDocument));

function ensure(d: A11yDocument, id: string, attrs: Record<string, string>): A11yElement {
  let el = d.getElementById(id);
  if (!el) {
    el = d.createElement('div');
    el.id = id;
    d.body.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function clear(el: A11yElement): void {
  while (el.firstChild) el.removeChild(el.firstChild as A11yElement);
}

/** Create (or adopt) the two hidden nodes. Call once at boot; tests pass a fake document. */
export function initA11y(d: A11yDocument | null = defaultDoc()): void {
  doc = d;
  menus.length = 0;
  recent.length = 0;
  if (!d) return;
  ensure(d, LIVE_ID, { role: 'log', 'aria-live': 'polite', 'aria-label': 'Game log', style: SR_ONLY });
  ensure(d, MENU_ID, { role: 'listbox', 'aria-label': 'Menu', style: SR_ONLY });
}

const live = (): A11yElement | null => doc?.getElementById(LIVE_ID) ?? null;
const list = (): A11yElement | null => doc?.getElementById(MENU_ID) ?? null;

/**
 * Speak text: one live-region line per paragraph, blank ones skipped. `dedupe` (modals, panels) skips paragraphs that
 * were just spoken, e.g. an event already read as a log line; log lines themselves always speak, repeats included.
 */
export function announce(text: string, dedupe = false): void {
  const el = live();
  if (!el || !doc) return;
  for (const raw of text.split(/\n\s*\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line || (dedupe && recent.includes(line))) continue;
    recent.push(line);
    if (recent.length > DEDUPE) recent.shift();
    const p = doc.createElement('p');
    p.textContent = line;
    el.appendChild(p);
    while (el.childElementCount > LIVE_MAX && el.firstChild) el.removeChild(el.firstChild as A11yElement);
  }
}

/** The current live-region lines (for tests and debugging). */
export function liveLines(): string[] {
  const out: string[] = [];
  let n = live()?.firstChild as (A11yElement & { nextSibling?: unknown }) | null | undefined;
  while (n) {
    out.push(n.textContent ?? '');
    n = n.nextSibling as typeof n;
  }
  return out;
}

/** Text marker before a disabled row's label (in addition to the dim color), on the canvas and in the listbox. */
export const DISABLED_MARK = 'x ';

/** Option text: number, label, and the reason when disabled. */
export function optionText(item: A11yItem, i: number): string {
  const base = `${i + 1}. ${item.disabled ? DISABLED_MARK : ''}${item.label.trim()}`;
  return item.disabled ? `${base} (unavailable: ${item.disabled})` : base;
}

/** The menu the listbox mirrors: the newest one still alive. */
function top(): A11yMenu | undefined {
  for (let i = menus.length - 1; i >= 0; i--) {
    const m = menus[i]!;
    if (m.alive()) return m;
    menus.splice(i, 1);
  }
  return undefined;
}

/** Speak a screen's visible lines as one batched live-region message (one `<p>`), for read-aloud on open / page change. */
export function announceScreen(lines: readonly string[]): void {
  const text = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('. ');
  if (text) announce(text);
}

/** Re-render the listbox from the topmost live menu (empty when there is none). */
export function syncMenu(): void {
  const el = list();
  if (!el || !doc) return;
  clear(el);
  const m = top();
  if (!m) {
    el.removeAttribute('aria-activedescendant');
    return;
  }
  m.items().forEach((item, i) => {
    const o = doc!.createElement('div');
    o.id = `${MENU_ID}-${i}`;
    o.setAttribute('role', 'option');
    o.setAttribute('aria-selected', String(i === m.cursor));
    if (item.disabled) o.setAttribute('aria-disabled', 'true');
    o.textContent = optionText(item, i);
    el.appendChild(o);
  });
  el.setAttribute('aria-activedescendant', `${MENU_ID}-${m.cursor}`);
}

/** A menu was created: it becomes the mirrored one. */
export function pushMenu(m: A11yMenu): void {
  menus.push(m);
  syncMenu();
}

/** A menu was destroyed: the one beneath (if any) is mirrored again. */
export function removeMenu(m: A11yMenu): void {
  const i = menus.lastIndexOf(m);
  if (i >= 0) menus.splice(i, 1);
  syncMenu();
}

/** Forget every menu (a new scene starts). */
export function clearMenus(): void {
  menus.length = 0;
  syncMenu();
}
