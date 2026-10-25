import { expect, test, type Page } from '@playwright/test';
import { body, buy, getState, leaveStore, loadPatchedState, minigameOf, pressUntilScene, sceneTexts, snap, startRun } from './helpers';

// minigames.md section 3: at the Flare Belt (waypoint 15) the Hazard scene lists Ride the solar wind / Pay the tug;
// Ride opens the Flare scene (mini-games on) and its hits go through `cross thread` with a FlareResult. The run is
// parked at the Flare Belt with `__PROXIMA__.loadState` (`?debug=1`), which also enables finishWith.

const FLARE_BELT = {
  segment: 16, arrivedAt: 15, distanceInSegment: 0, offlineDrives: [], justCrossedHazard: false,
  broken: { hull: false, pump: false, gyro: false }, crossing: { waypoint: 15, density: 5, pilotDaysLeft: null },
};

async function atFlareBelt(page: Page, seed: string, query = '&debug=1'): Promise<void> {
  await startRun(page, seed, false, query);
  for (const [row, qty] of [[1, 3], [2, 2000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await leaveStore(page);
  await loadPatchedState(page, FLARE_BELT);
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  await page.waitForTimeout(150);
}

async function ride(page: Page): Promise<void> {
  await page.keyboard.press('1');
  await expect(body(page)).toHaveAttribute('data-scene', 'Flare');
  await expect(body(page)).toHaveAttribute('data-minigame', 'flare');
}

test('Flare Belt lists Ride / Pay the tug; a 5-hit result is a crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await atFlareBelt(page, 'FLARE-CRASH');
  const texts = await sceneTexts(page, 'Hazard');
  expect(texts.some((s) => s.includes('Ride the solar wind'))).toBe(true);
  expect(texts.some((s) => s.includes('Pay the tug'))).toBe(true);
  expect(texts.some((s) => s.includes('Shields'))).toBe(false);
  await snap(page, 'Hazard-flare-belt');
  await ride(page);
  expect(await sceneTexts(page, 'Flare')).toContain('FLARE BELT');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await minigameOf(page))?.elapsed ?? 0, { timeout: 5000 }).toBeGreaterThan(0.1);
  await snap(page, 'Flare-play');

  const before = (await getState(page))!;
  expect(await page.evaluate(() => window.__PROXIMA__?.minigame?.finishWith({ kind: 'flare', hits: 5 }))).toBeNull();
  const after = (await getState(page))!;
  expect(after.crossing).toBeNull();
  expect(after.crew.filter((c) => c.alive).length).toBe(before.crew.filter((c) => c.alive).length - 1);
  expect(after.broken.hull).toBe(true);
  expect(after.supplies.rations).toBe(before.supplies.rations - Math.floor(before.supplies.rations / 2));
  expect(after.log.some((e) => e.kind === 'flare' && e.id === 'crash')).toBe(true);
  expect(after.rodeTheWind).toBe(false);
  expect(await sceneTexts(page, 'Flare')).toContain('Crash. The wind won.');
  await snap(page, 'Flare-crash');
  await page.waitForTimeout(450);
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  await pressUntilScene(page, 'Travel');
  expect(errors).toEqual([]);
});

test('a clean ride sets rodeTheWind and shows "Rode the wind!"', async ({ page }) => {
  await atFlareBelt(page, 'FLARE-CLEAN');
  await ride(page);
  expect(await page.evaluate(() => window.__PROXIMA__?.minigame?.finishWith({ kind: 'flare', hits: 0 }))).toBeNull();
  const s = (await getState(page))!;
  expect(s.rodeTheWind).toBe(true);
  expect(s.log.some((e) => e.kind === 'flare' && e.id === 'clean')).toBe(true);
  expect(await sceneTexts(page, 'Flare')).toContain('Rode the wind!');
});

test('finishNow plays the rest idle; the hits it returns are applied', async ({ page }) => {
  await atFlareBelt(page, 'FLARE-IDLE');
  await ride(page);
  await page.evaluate(() => window.__PROXIMA__?.minigame?.finishNow());
  const m = (await minigameOf(page))!;
  expect(m.result).toMatchObject({ kind: 'flare' });
  const hits = (m.result as { hits: number }).hits;
  expect(hits).toBeGreaterThanOrEqual(0);
  expect(hits).toBeLessThanOrEqual(5);
  if (hits < 5) expect(m.elapsed).toBeCloseTo(45, 1);
  const s = (await getState(page))!;
  expect(s.crossing).toBeNull();
  expect(s.rodeTheWind).toBe(hits === 0);
  expect(s.log.filter((e) => e.kind === 'flare').length).toBeGreaterThan(0);
});

test('?minigames=auto: Ride the solar wind is the statistical roll, no Flare scene', async ({ page }) => {
  await atFlareBelt(page, 'FLARE-AUTO', '&minigames=auto&debug=1');
  await page.keyboard.press('1');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  expect(await body(page).getAttribute('data-scene')).toBe('Hazard');
  const s = (await getState(page))!;
  expect(s.crossing).toBeNull();
  expect(s.log.some((e) => e.kind === 'crossing' && e.id === 'thread')).toBe(true);
  expect(s.log.some((e) => e.kind === 'flare')).toBe(false);
});
