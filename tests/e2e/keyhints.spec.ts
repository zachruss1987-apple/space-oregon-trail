import { expect, test, type Page } from '@playwright/test';
import {
  autoTravelUntil, body, buy, generousRun, gotoScene, leaveStore, loadPatchedState, reachWaypoint, startRun,
} from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS } from './seeds';

// Key hints bar (docs/design/keyhints.md, T-069): body[data-hints] mirrors the set id the KeyRouter publishes. Set ids and
// the "non-empty at every stopping point" rule come from the spec table; `nameEntry` and `title` wording are logged deviations.

const SEED = FAST_FIRST_WAYPOINT_SEEDS[0] as string;
const OPTS_KEY = 'proxima.options';

/** Wait until body[data-hints] equals `id` (a spec set id). */
const hints = (page: Page, id: string) => expect(body(page), `hints should be ${id}`).toHaveAttribute('data-hints', id);
/** The shown set is any non-empty id other than `none`. */
const someHints = async (page: Page, label: string): Promise<string> => {
  const id = await body(page).getAttribute('data-hints');
  expect(id, `${label}: data-hints present`).toBeTruthy();
  expect(id, `${label}: not none`).not.toBe('none');
  return id!;
};
const scene = (page: Page, key: string) => expect(body(page)).toHaveAttribute('data-scene', key);
const storedHints = (page: Page) => page.evaluate((k) => (JSON.parse(localStorage.getItem(k) ?? '{}') as { keyHints?: string }).keyHints, OPTS_KEY);

test('menus: Title, ? overlay, Guide, Top Ten, Options show their sets (spec "Which hints show")', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoScene(page, 'Title', SEED, '&minigames=auto');
  await hints(page, 'title');
  await page.keyboard.press('?');
  await expect(body(page)).toHaveAttribute('data-help', '1');
  await hints(page, 'help');
  await page.keyboard.press('Escape');
  await hints(page, 'title');
  await page.keyboard.press('2');
  await scene(page, 'Guide');
  await hints(page, 'guide');
  await page.keyboard.press('Escape');
  await scene(page, 'Title');
  await page.keyboard.press('3');
  await scene(page, 'TopTen');
  await hints(page, 'table');
  await page.keyboard.press('Escape');
  await page.keyboard.press('4');
  await scene(page, 'Options');
  await hints(page, 'options');
  await page.keyboard.press('?');
  await hints(page, 'help');
  await page.keyboard.press('Escape');
  await hints(page, 'options');
  await page.keyboard.press('Escape');
  await scene(page, 'Title');
  await hints(page, 'title');
  expect(errors).toEqual([]);
});

test('Setup (profession menu, name entry, window) and Store (menu, quantity prompt, confirm, farewell) show sets', async ({ page }) => {
  test.setTimeout(60_000);
  await gotoScene(page, 'Title', SEED, '&minigames=auto');
  if ((await page.evaluate(() => !!localStorage.getItem('proxima.autosave')))) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await scene(page, 'Setup');
  await someHints(page, 'Setup profession');
  expect(['menu', 'menuBack']).toContain(await body(page).getAttribute('data-hints'));
  await page.keyboard.press('Enter');
  await hints(page, 'name'); // Setup names keep Tab (random names)
  await page.keyboard.type('Ada');
  await hints(page, 'name');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
  await someHints(page, 'Setup window');
  await page.keyboard.press('Enter');
  await scene(page, 'Store');
  await someHints(page, 'Store menu');
  expect(['menu', 'menuBack']).toContain(await body(page).getAttribute('data-hints'));
  await page.keyboard.press('1');
  await hints(page, 'number');
  await page.keyboard.type('2');
  await page.keyboard.press('Enter');
  expect(['menu', 'menuBack']).toContain(await body(page).getAttribute('data-hints'));
  await someHints(page, 'Store after prompt');
  await page.keyboard.press('8');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  expect(['modal', 'modalChoice']).toContain(await body(page).getAttribute('data-hints'));
  await page.keyboard.press('Enter');
  await someHints(page, 'Store farewell');
  await page.keyboard.press('Enter');
  await scene(page, 'Travel');
  await hints(page, 'travel');
});

test('Travel: modal, auto-travel set and back, Supplies and Map tables, Waypoint, Hazard and its outcome modal', async ({ page }) => {
  test.setTimeout(90_000);
  await generousRun(page, SEED);
  await hints(page, 'travel');
  await page.keyboard.press('5'); // Change rations (a choice modal)
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await hints(page, 'modalChoice');
  await page.keyboard.press('Escape');
  await expect(body(page)).not.toHaveAttribute('data-modal', '1');
  await hints(page, 'travel');
  await page.keyboard.press('2');
  await scene(page, 'Supplies');
  await hints(page, 'table');
  await page.keyboard.press('Enter');
  await scene(page, 'Travel');
  await page.keyboard.press('3');
  await scene(page, 'Map');
  await hints(page, 'table');
  await page.keyboard.press('Escape');
  await scene(page, 'Travel');
  await page.keyboard.press('t');
  await hints(page, 'travelAuto');
  await page.keyboard.press('t'); // any key stops (an event modal may land first under load: dismiss it)
  await expect.poll(async () => {
    if ((await body(page).getAttribute('data-modal')) === '1') await page.keyboard.press('Enter');
    return body(page).getAttribute('data-hints');
  }).toBe('travel');
  await autoTravelUntil(page, (_s, sc) => sc === 'Waypoint');
  await someHints(page, 'Waypoint');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await scene(page, 'Hazard');
  await page.waitForTimeout(200);
  await someHints(page, 'Hazard');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await someHints(page, 'Hazard outcome');
});

test('Station menu and its Trade sub-screen show a set', async ({ page }) => {
  test.setTimeout(90_000);
  await generousRun(page, SEED);
  await reachWaypoint(page, 3);
  await someHints(page, 'Waypoint (station)');
  await page.keyboard.press('2');
  await scene(page, 'Station');
  await page.waitForTimeout(500);
  await someHints(page, 'Station');
  await page.keyboard.press('2');
  await page.waitForTimeout(600);
  await someHints(page, 'Station trade');
});

const FLARE_BELT = {
  segment: 16, arrivedAt: 15, distanceInSegment: 0, offlineDrives: [], justCrossedHazard: false,
  broken: { hull: false, pump: false, gyro: false }, crossing: { waypoint: 15, density: 5, pilotDaysLeft: null },
};

test('mini-games: intro, play, pause, done (Flare via Hazard) and Salvage with its fire key', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page, 'T070-MG', false, '&debug=1');
  for (const [row, qty] of [[1, 3], [2, 2000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await leaveStore(page);
  // Salvage: instruction screen -> play with a Fire key.
  await page.keyboard.press('8');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.keyboard.press('Enter');
  await scene(page, 'Salvage');
  await hints(page, 'minigameIntro');
  await page.keyboard.press('Space');
  await hints(page, 'minigameFire');
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-paused', '1');
  await someHints(page, 'Salvage paused');
  await page.keyboard.press('Enter'); // Resume
  await expect(body(page)).not.toHaveAttribute('data-paused', '1');
  await hints(page, 'minigameFire');
  await page.evaluate(() => window.__PROXIMA__?.minigame?.finishNow());
  await hints(page, 'minigameDone');
  await page.waitForTimeout(450);
  await page.keyboard.press('Enter');
  await scene(page, 'Travel');
  await hints(page, 'travel');
  // Flare: intro -> play (no fire key) -> done.
  await loadPatchedState(page, FLARE_BELT);
  await scene(page, 'Hazard');
  await page.waitForTimeout(150);
  await page.keyboard.press('1');
  await scene(page, 'Flare');
  await hints(page, 'minigameIntro');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.minigame?.elapsed ?? 0)).toBeGreaterThan(0.1);
  await hints(page, 'minigamePlay');
  await page.evaluate(() => window.__PROXIMA__?.minigame?.finishWith({ kind: 'flare', hits: 0 }));
  await hints(page, 'minigameDone');
});

test('Death: the beacon epitaph prompt shows nameEntry (no Tab), then the scene shows a set', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page, 'DEATHSEED');
  await buy(page, 1, 1);
  await leaveStore(page);
  await autoTravelUntil(page, (s, sc) => sc === 'Death' || (sc === 'Travel' && s.crew.some((c) => !c.alive)));
  await page.keyboard.press('Enter'); // death modal -> beacon prompt
  await expect(body(page)).toHaveAttribute('data-beacon', '1');
  await hints(page, 'nameEntry');
  await page.keyboard.type('Here lies a test');
  await hints(page, 'nameEntry');
  await page.keyboard.press('Enter');
  await expect(body(page)).not.toHaveAttribute('data-beacon', '1');
  await someHints(page, 'after beacon');
});

test('Death scene itself shows a non-empty set', async ({ page }) => {
  test.setTimeout(120_000);
  await startRun(page, 'DEATHSEED');
  await buy(page, 1, 1);
  await leaveStore(page);
  await autoTravelUntil(page, (_s, sc) => sc === 'Death');
  await page.waitForTimeout(1500);
  await someHints(page, 'Death scene');
});

test('?platform=touch removes data-hints, ?platform=mac keeps it and reports the platform', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&platform=touch`);
  await scene(page, 'Title');
  await expect(body(page)).toHaveAttribute('data-platform', 'touch');
  await expect(body(page)).not.toHaveAttribute('data-hints', /.*/);
  await page.goto(`/?seed=${SEED}&platform=mac`);
  await scene(page, 'Title');
  await expect(body(page)).toHaveAttribute('data-platform', 'mac');
  await hints(page, 'title');
});

test('Options Key hints row cycles Auto/On/Off, persists, and Off removes data-hints; On shows on touch', async ({ page }) => {
  await gotoScene(page, 'Title', SEED, '&minigames=auto');
  await page.keyboard.press('4');
  await scene(page, 'Options');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown'); // row 6
  await page.keyboard.press('ArrowRight'); // Auto -> On
  await expect.poll(() => storedHints(page)).toBe('on');
  await hints(page, 'options');
  await page.keyboard.press('ArrowRight'); // On -> Off
  await expect.poll(() => storedHints(page)).toBe('off');
  await expect(body(page)).not.toHaveAttribute('data-hints', /.*/);
  await page.keyboard.press('ArrowRight'); // Off -> Auto
  await expect.poll(() => storedHints(page)).toBe('auto');
  await hints(page, 'options');
  await page.keyboard.press('ArrowLeft'); // Auto -> Off
  await expect.poll(() => storedHints(page)).toBe('off');
  await page.reload();
  await scene(page, 'Title');
  await expect(body(page)).not.toHaveAttribute('data-hints', /.*/); // Off survives a reload
  // On overrides touch (an iPad with a keyboard).
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, keyHints: 'on' })), OPTS_KEY);
  await page.goto(`/?seed=${SEED}&platform=touch`);
  await scene(page, 'Title');
  await hints(page, 'title');
});
