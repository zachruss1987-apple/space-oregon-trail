import { expect, test, type Page } from '@playwright/test';
import { autoTravelUntil, body, buy, getState, leaveStore, loadPatchedState, minigameOf, pressUntilScene, sceneTexts, snap, startRun } from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS } from './seeds';

// minigames.md section 2 + the UI contract: the Hazard scene's Thread it opens Debris Threading (mini-games on), the
// run's result goes through `cross thread` with `result`, and the Hazard scene replays the crossing on return.
// `?debug=1` enables finishWith and loadState (tests/unit/minigames/threadingLogic.test.ts pins the CLEAN-0 / CLEAN-1
// fixture: an idle run there takes 0 / 1 hits).

const SHOPPING = [[1, 3], [2, 2000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const;

/** Park the run at the Lunar Debris Ring (density 1, window 1, intact ship) with seed label `seed` on day 10. */
const lunarFixture = (seed: string) => ({
  seed, day: 10, segment: 2, arrivedAt: 1, distanceInSegment: 0, window: 1, route: 'oort', offlineDrives: [],
  broken: { hull: false, pump: false, gyro: false }, justCrossedHazard: false, crossing: { waypoint: 1, density: 1, pilotDaysLeft: null },
});

async function storeToTravel(page: Page, seed: string): Promise<void> {
  await startRun(page, seed, false, '&debug=1'); // mini-games on
  for (const [row, qty] of SHOPPING) await buy(page, row, qty);
  await leaveStore(page);
}

/** From the Hazard scene: option 1 (Thread it) opens the Threading scene on its instruction screen. */
async function threadIt(page: Page): Promise<void> {
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  await page.waitForTimeout(150);
  await page.keyboard.press('1');
  await expect(body(page)).toHaveAttribute('data-scene', 'Threading');
  await expect(body(page)).toHaveAttribute('data-minigame', 'threading');
}

test('Thread it opens Debris Threading; hits from the run become severity rolls; back to Hazard, then Travel', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await storeToTravel(page, FAST_FIRST_WAYPOINT_SEEDS[0] as string);
  const arrived = await autoTravelUntil(page, (_st, scene) => scene === 'Waypoint');
  expect(arrived.crossing?.waypoint).toBe(1);
  await page.keyboard.press('Enter'); // Approach the crossing
  await threadIt(page);
  expect(await sceneTexts(page, 'Threading')).toContain('DEBRIS THREADING');
  expect(await minigameOf(page)).toMatchObject({ kind: 'threading', elapsed: 0, result: null });

  await page.keyboard.press('Enter'); // start: countdown, then play
  await expect.poll(async () => (await minigameOf(page))?.elapsed ?? 0, { timeout: 5000 }).toBeGreaterThan(0.1);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowUp');
  await snap(page, 'Threading-play');
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-paused', '1');
  await page.keyboard.press('Enter'); // Resume
  await expect(body(page)).not.toHaveAttribute('data-paused', '1');

  const before = (await getState(page))!;
  expect(await page.evaluate(() => window.__PROXIMA__?.minigame?.finishWith({ kind: 'threading', hits: 2, bonus: 'health' }))).toBe('A bonus needs a clean run.');
  expect(await page.evaluate(() => window.__PROXIMA__?.minigame?.finishWith({ kind: 'threading', hits: 2, bonus: null }))).toBeNull();
  expect((await minigameOf(page))!.result).toEqual({ kind: 'threading', hits: 2, bonus: null });
  const after = (await getState(page))!;
  expect(after.crossing).toBeNull();
  expect(after.day).toBe(before.day);
  const fresh = after.log.slice(before.log.length);
  expect(fresh.map((e) => `${e.kind}/${e.id}`).slice(0, 2)).toEqual(['crossing/thread', 'threading/hit']);
  expect(fresh.filter((e) => e.kind === 'hazard')).toHaveLength(2);
  expect(await sceneTexts(page, 'Threading')).toContain('Run complete');
  await snap(page, 'Threading-result');

  await page.waitForTimeout(450);
  await page.keyboard.press('Enter'); // leave the panel: Hazard replays the crossing
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  await expect(body(page)).toHaveAttribute('data-modal', '1'); // outcome modal
  await pressUntilScene(page, 'Travel');
  expect(await minigameOf(page)).toBeNull();
  expect(errors).toEqual([]);
});

test('a clean run offers the bonus pick; +10 rations is applied', async ({ page }) => {
  await storeToTravel(page, 'THREAD-BONUS');
  await loadPatchedState(page, lunarFixture('CLEAN-0'));
  await threadIt(page);
  const before = (await getState(page))!;
  await page.evaluate(() => window.__PROXIMA__?.minigame?.finishNow());
  await expect(body(page)).toHaveAttribute('data-modal', '1'); // "Clean run. Choose your reward:"
  expect((await sceneTexts(page, 'Threading')).some((s) => s.includes('+10 rations'))).toBe(true);
  expect((await getState(page))!.crossing).not.toBeNull(); // nothing is sent until the pick
  await snap(page, 'Threading-bonus');
  await page.keyboard.press('2');
  await expect(body(page)).not.toHaveAttribute('data-modal', '1');
  expect((await minigameOf(page))!.result).toEqual({ kind: 'threading', hits: 0, bonus: 'rations' });
  const after = (await getState(page))!;
  expect(after.supplies.rations).toBe(before.supplies.rations + 10);
  expect(after.log.slice(before.log.length).map((e) => `${e.kind}/${e.id}`)).toEqual(['crossing/thread', 'threading/clean', 'hazard/clear']);
  await page.waitForTimeout(450);
  await pressUntilScene(page, 'Travel');
});

test('an idle run with a hit sends hits without a bonus pick', async ({ page }) => {
  await storeToTravel(page, 'THREAD-IDLE');
  await loadPatchedState(page, lunarFixture('CLEAN-1'));
  await threadIt(page);
  await page.evaluate(() => window.__PROXIMA__?.minigame?.finishNow());
  expect((await minigameOf(page))!.result).toEqual({ kind: 'threading', hits: 1, bonus: null });
  await expect(body(page)).not.toHaveAttribute('data-modal', '1');
  expect((await getState(page))!.log.some((e) => e.kind === 'threading' && e.id === 'hit')).toBe(true);
});

test('Skip from the pause menu: statistical thread with the penalty, logged info/skipped', async ({ page }) => {
  await storeToTravel(page, 'THREAD-SKIP');
  await loadPatchedState(page, lunarFixture('CLEAN-1'));
  await threadIt(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-paused', '1');
  await page.keyboard.press('2'); // Skip (penalty)
  await page.keyboard.press('2'); // confirm: Skip it
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  const s = (await getState(page))!;
  expect(s.crossing).toBeNull();
  expect(s.log.some((e) => e.kind === 'info' && e.id === 'skipped')).toBe(true);
  expect(s.log.some((e) => e.kind === 'threading')).toBe(false);
  await pressUntilScene(page, 'Travel');
});
