import { beforeEach, describe, expect, it } from 'vitest';
import {
  announce, clearMenus, initA11y, LIVE_ID, LIVE_MAX, liveLines, MENU_ID, optionText, pushMenu, removeMenu, syncMenu,
  type A11yDocument, type A11yElement, type A11yItem, type A11yMenu,
} from '@/game/a11y';

/** A minimal DOM: elements with attributes, text and an ordered child list. */
class FakeEl implements A11yElement {
  id = '';
  textContent: string | null = null;
  readonly attrs = new Map<string, string>();
  readonly children: FakeEl[] = [];
  parent: FakeEl | null = null;
  constructor(readonly tag: string) {}
  setAttribute(n: string, v: string): void {
    this.attrs.set(n, v);
  }
  removeAttribute(n: string): void {
    this.attrs.delete(n);
  }
  appendChild(c: A11yElement): unknown {
    const el = c as FakeEl;
    el.parent = this;
    this.children.push(el);
    return c;
  }
  removeChild(c: A11yElement): unknown {
    this.children.splice(this.children.indexOf(c as FakeEl), 1);
    (c as FakeEl).parent = null;
    return c;
  }
  get firstChild(): FakeEl | null {
    return this.children[0] ?? null;
  }
  get nextSibling(): FakeEl | null {
    const p = this.parent;
    return p ? (p.children[p.children.indexOf(this) + 1] ?? null) : null;
  }
  get childElementCount(): number {
    return this.children.length;
  }
}

class FakeDoc implements A11yDocument {
  readonly body = new FakeEl('body');
  getElementById(id: string): FakeEl | null {
    return this.body.children.find((c) => c.id === id) ?? null;
  }
  createElement(tag: string): FakeEl {
    return new FakeEl(tag);
  }
}

type TestMenu = A11yMenu & { cursor: number; dead: boolean };
function menu(items: A11yItem[], cursor = 0): TestMenu {
  const m: TestMenu = { cursor, dead: false, items: () => items, alive: () => !m.dead };
  return m;
}

let doc: FakeDoc;
const live = (): FakeEl => doc.getElementById(LIVE_ID)!;
const box = (): FakeEl => doc.getElementById(MENU_ID)!;
const options = () =>
  box().children.map((o) => ({
    text: o.textContent,
    selected: o.attrs.get('aria-selected'),
    disabled: o.attrs.get('aria-disabled') ?? null,
    role: o.attrs.get('role'),
  }));

beforeEach(() => {
  doc = new FakeDoc();
  initA11y(doc);
});

describe('a11y live region and listbox', () => {
  it('creates a polite log and a listbox, visually hidden, once', () => {
    expect(live().attrs.get('role')).toBe('log');
    expect(live().attrs.get('aria-live')).toBe('polite');
    expect(box().attrs.get('role')).toBe('listbox');
    for (const el of [live(), box()]) expect(el.attrs.get('style')).toMatch(/width:1px;height:1px.*overflow:hidden.*clip/);
    initA11y(doc);
    expect(doc.body.children).toHaveLength(2);
  });

  it('announces one line per paragraph, squashing whitespace and skipping blanks', () => {
    announce('Day 3. Pirates!\n\n  You lost   40 rations.  \n\n');
    announce('   ');
    expect(liveLines()).toEqual(['Day 3. Pirates!', 'You lost 40 rations.']);
  });

  it('log lines repeat; deduped text (modals, panels) skips lines just spoken', () => {
    announce('A quiet day.');
    announce('A quiet day.');
    announce('Pirates!');
    announce('Pirates!\n\nWhat now?', true);
    expect(liveLines()).toEqual(['A quiet day.', 'A quiet day.', 'Pirates!', 'What now?']);
  });

  it(`keeps the newest ${LIVE_MAX} lines`, () => {
    for (let i = 0; i < LIVE_MAX + 5; i++) announce(`line ${i}`);
    const lines = liveLines();
    expect(lines).toHaveLength(LIVE_MAX);
    expect(lines[0]).toBe('line 5');
    expect(lines.at(-1)).toBe(`line ${LIVE_MAX + 4}`);
  });

  it('mirrors the newest menu: numbered options, the selection, disabled rows with their reason', () => {
    const m = menu([{ label: 'Continue on the Lane' }, { label: '  Scan for salvage', disabled: 'Out of charges.' }, { label: 'Rest' }], 2);
    pushMenu(m);
    expect(options()).toEqual([
      { text: '1. Continue on the Lane', selected: 'false', disabled: null, role: 'option' },
      { text: '2. x Scan for salvage (unavailable: Out of charges.)', selected: 'false', disabled: 'true', role: 'option' },
      { text: '3. Rest', selected: 'true', disabled: null, role: 'option' },
    ]);
    expect(box().attrs.get('aria-activedescendant')).toBe(`${MENU_ID}-2`);
    m.cursor = 0;
    syncMenu();
    expect(options().map((o) => o.selected)).toEqual(['true', 'false', 'false']);
  });

  it('a modal menu covers the scene menu and uncovers it when removed; dead menus are skipped', () => {
    const scene = menu([{ label: 'Travel' }]);
    const modal = menu([{ label: 'Yes' }, { label: 'No' }], 1);
    pushMenu(scene);
    pushMenu(modal);
    expect(options().map((o) => o.text)).toEqual(['1. Yes', '2. No']);
    removeMenu(modal);
    expect(options().map((o) => o.text)).toEqual(['1. Travel']);
    pushMenu(modal);
    modal.dead = true;
    syncMenu();
    expect(options().map((o) => o.text)).toEqual(['1. Travel']);
    clearMenus();
    expect(box().children).toHaveLength(0);
    expect(box().attrs.has('aria-activedescendant')).toBe(false);
  });

  it('optionText formats enabled and disabled rows', () => {
    expect(optionText({ label: 'Options' }, 4)).toBe('5. Options');
    expect(optionText({ label: 'Export save', disabled: 'No journey.' }, 9)).toBe('10. x Export save (unavailable: No journey.)');
  });

  it('is a no-op without a document', () => {
    initA11y(null);
    expect(() => {
      announce('x');
      pushMenu(menu([{ label: 'a' }]));
      clearMenus();
    }).not.toThrow();
    expect(liveLines()).toEqual([]);
  });
});
