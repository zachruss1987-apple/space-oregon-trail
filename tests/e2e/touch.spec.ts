import { expect, test, type Page } from '@playwright/test';
import { body, buy, getState, sceneTexts } from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS } from './seeds';

/**
 * Real-touch suite (T-072), project `touch`: WebKit + iPhone 13 profile (hasTouch, isMobile, pointer: coarse). There is no
 * `?platform=` override: detection must find touch itself. Spec: docs/design/keyhints.md "Touch platform: on-screen keys".
 *
 * How buttons are found: the band's buttons are drawn as bitmap-text labels at logical y >= 400 inside the active scene.
 * `tapBand` reads the scene graph for the label (like `sceneTexts`), takes its logical centre (text x + len*4: a button
 * is (len + 2) glyphs wide with the text one glyph in) at band mid-height (y 412), and maps it to CSS pixels through
 * `canvas.getBoundingClientRect()` (logical 640 x 424). The first test also checks the first button's x against the
 * layout rule (left edge x = 8), so the lookup cannot drift from the spec. Taps are `page.touchscreen.tap`.
 */

const SEED = FAST_FIRST_WAYPOINT_SEEDS[0] as string;
const LOGICAL_W = 640;
const LOGICAL_H = 424; // 400 view + 24 touch band
const BAND_MID_Y = 412;

const scene = (page: Page, key: string) => expect(body(page)).toHaveAttribute('data-scene', key);
const hints = (page: Page, id: string) => expect(body(page), `hints should be ${id}`).toHaveAttribute('data-hints', id);

/** Logical position of the band text `label` in the active scene(s), or null. */
async function findLabel(page: Page, label: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((l) => {
    type Node = { text?: unknown; x?: number; y?: number };
    const game = window.__PROXIMA__?.game as { scene: { getScenes(active: boolean): { children: { list: Node[] } }[] } } | undefined;
    for (const sc of game?.scene.getScenes(true) ?? []) {
      for (const o of sc.children.list) if (o.text === l && (o.y ?? 0) >= 400) return { x: o.x ?? 0, y: o.y ?? 0 };
    }
    return null;
  }, label);
}

/** Tap the on-screen key labelled `label` with a real touch. */
async function tapBand(page: Page, label: string): Promise<void> {
  await expect.poll(() => findLabel(page, label), { message: `band button "${label}" present` }).not.toBeNull();
  const at = (await findLabel(page, label))!;
  const r = await page.evaluate(() => {
    const b = (document.querySelector('canvas') as HTMLCanvasElement).getBoundingClientRect();
    return { left: b.left, top: b.top, width: b.width, height: b.height };
  });
  const cx = at.x + label.length * 4; // text starts one glyph into the button
  await page.touchscreen.tap(r.left + (cx * r.width) / LOGICAL_W, r.top + (BAND_MID_Y * r.height) / LOGICAL_H);
}

async function toTitle(page: Page, query = '&minigames=auto'): Promise<void> {
  await page.goto(`/?seed=${SEED}${query}`);
  await scene(page, 'Title');
}

/** Title -> Setup -> Store using only band taps (Choose, OK). */
async function tapToStore(page: Page): Promise<void> {
  await tapBand(page, 'Choose');
  await scene(page, 'Setup');
  await tapBand(page, 'Choose'); // profession
  for (let i = 0; i < 5; i++) {
    await hints(page, 'name');
    await tapBand(page, 'OK');
  }
  await tapBand(page, 'Choose'); // launch window
  await scene(page, 'Store');
}

/** Store: Leave (row 8 by keyboard: no band key selects a row), then the confirm and farewell by tap. */
async function tapLeaveStore(page: Page): Promise<void> {
  if (!(await getState(page))!.supplies.drives) {
    await buy(page, 1, 1); // leaving needs an ion drive; a typed quantity (no soft keyboard in the game, Playwright types)
    await buy(page, 2, 500);
  }
  await page.keyboard.press('8');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await tapBand(page, 'Choose');
  await tapBand(page, 'OK');
  await scene(page, 'Travel');
}

test('real touch is detected: platform and hint mode, 424/640 canvas, canvas inside the visible viewport', async ({ page }) => {
  await toTitle(page);
  await expect(body(page)).toHaveAttribute('data-platform', 'touch');
  await expect(body(page)).toHaveAttribute('data-hintmode', 'touch');
  await hints(page, 'title');
  const m = await page.evaluate(() => {
    const b = (document.querySelector('canvas') as HTMLCanvasElement).getBoundingClientRect();
    return { w: b.width, h: b.height, bottom: b.bottom, top: b.top, inner: window.innerHeight };
  });
  expect(m.h / m.w).toBeCloseTo(424 / 640, 2);
  expect(m.bottom).toBeLessThanOrEqual(m.inner + 0.5);
  expect(m.top).toBeGreaterThanOrEqual(-0.5);
  // Layout rule: the first button's left edge is x = 8, so its label sits at x = 16.
  const choose = await findLabel(page, 'Choose');
  expect(choose?.x).toBe(16);
  expect(choose?.y).toBeGreaterThanOrEqual(400);
});

test('Title: tap Help opens the overlay, tap Close dismisses it', async ({ page }) => {
  await toTitle(page);
  await tapBand(page, 'Help');
  await expect(body(page)).toHaveAttribute('data-help', '1');
  await hints(page, 'help');
  await tapBand(page, 'Close');
  await expect(body(page)).not.toHaveAttribute('data-help', '1');
  await hints(page, 'title');
});

test('Setup name entry: tap Random then OK advances; the whole Setup runs from taps to the Store', async ({ page }) => {
  test.setTimeout(60_000);
  await toTitle(page);
  await tapBand(page, 'Choose');
  await scene(page, 'Setup');
  await tapBand(page, 'Choose'); // profession
  await hints(page, 'name');
  const before = (await sceneTexts(page, 'Setup')).join('|');
  await tapBand(page, 'Random');
  await expect.poll(async () => (await sceneTexts(page, 'Setup')).join('|')).not.toBe(before);
  await tapBand(page, 'OK');
  for (let i = 0; i < 4; i++) {
    await hints(page, 'name');
    await tapBand(page, 'OK');
  }
  await tapBand(page, 'Choose'); // window
  await scene(page, 'Store');
  expect((await getState(page))?.crew[0]?.name).toBeTruthy();
});

test('Store quantity prompt: +10, -1 and OK buy through taps', async ({ page }) => {
  test.setTimeout(60_000);
  await toTitle(page);
  await tapToStore(page);
  await tapBand(page, 'Choose'); // row 1 opens its quantity prompt
  await hints(page, 'number');
  const shown = async () => (await sceneTexts(page, 'Store')).join('|');
  const start = await shown();
  await tapBand(page, '+1');
  await expect.poll(shown).not.toBe(start);
  const one = await shown();
  await tapBand(page, '+10');
  await expect.poll(shown).not.toBe(one);
  await tapBand(page, '-1');
  await tapBand(page, 'OK');
  await expect(body(page)).not.toHaveAttribute('data-hints', 'number');
  const s = (await getState(page))!;
  expect(s.supplies.drives, '+1, +10, -1 then OK buys a quantity').toBeGreaterThan(1);
});

test('Travel: Travel on starts auto-travel (travelAuto), Stop returns to travel', async ({ page }) => {
  test.setTimeout(60_000);
  await toTitle(page);
  await tapToStore(page);
  await tapLeaveStore(page);
  await hints(page, 'travel');
  await tapBand(page, 'Travel on');
  await hints(page, 'travelAuto');
  await tapBand(page, 'Stop');
  await hints(page, 'travel');
});

test('Supplies shows a single Back that returns to Travel', async ({ page }) => {
  test.setTimeout(60_000);
  await toTitle(page);
  await tapToStore(page);
  await tapLeaveStore(page);
  await page.keyboard.press('2'); // Check supplies (Travel row 2)
  await scene(page, 'Supplies');
  await hints(page, 'table');
  const labels = await sceneTexts(page, 'Supplies');
  expect(labels.filter((x) => x === 'Back'), 'one Back button').toHaveLength(1);
  await tapBand(page, 'Back');
  await scene(page, 'Travel');
});

test('Guide: < and > turn pages, Back returns to the Title', async ({ page }) => {
  await toTitle(page);
  await page.keyboard.press('2'); // Title row 2: Guide
  await scene(page, 'Guide');
  await hints(page, 'guide');
  const pageText = async () => (await sceneTexts(page, 'Guide')).filter((t) => t.length > 20).join('|');
  const first = await pageText();
  await tapBand(page, '>');
  await expect.poll(pageText).not.toBe(first);
  await tapBand(page, '<');
  await expect.poll(pageText).toBe(first);
  await tapBand(page, 'Back');
  await scene(page, 'Title');
});

test('Salvage: Start, a Pause tap in the band does not fire the drone, Continue after the run', async ({ page }) => {
  test.setTimeout(60_000);
  await toTitle(page, '&debug=1'); // real mini-games (no &minigames=auto)
  await tapToStore(page);
  for (const [row, qty] of [[1, 3], [2, 2000], [4, 5]] as const) await buy(page, row, qty);
  await tapLeaveStore(page);
  const chargesBefore = (await getState(page))!.supplies.charges;
  await page.keyboard.press('8'); // Scan for salvage
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await tapBand(page, 'Choose'); // Yes
  await scene(page, 'Salvage');
  await hints(page, 'minigameIntro');
  await tapBand(page, 'Start');
  await hints(page, 'minigameFire');
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.minigame?.elapsed ?? 0), { timeout: 8000 }).toBeGreaterThan(0.1);
  const hud = async () => (await sceneTexts(page, 'Salvage')).filter((t) => t.startsWith('CHARGES'));
  const chargesHud = await hud();
  expect(chargesHud.length).toBeGreaterThan(0);
  await tapBand(page, 'Pause');
  await expect(body(page)).toHaveAttribute('data-paused', '1');
  expect(await hud(), 'the band tap must not fire the drone').toEqual(chargesHud);
  expect((await getState(page))!.supplies.charges).toBe(chargesBefore);
  await page.keyboard.press('Enter'); // Resume (pause menu)
  await expect(body(page)).not.toHaveAttribute('data-paused', '1');
  expect(await hud()).toEqual(chargesHud);
  await page.evaluate(() => window.__PROXIMA__?.minigame?.finishNow());
  await hints(page, 'minigameDone');
  await page.waitForTimeout(600); // the scene ignores confirm for 400 ms after the run ends
  await tapBand(page, 'Continue');
  await scene(page, 'Travel');
});
