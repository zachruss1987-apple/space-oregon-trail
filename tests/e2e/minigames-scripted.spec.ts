import { expect, test, type Page } from '@playwright/test';
import { body, buy, getState, leaveStore, loadPatchedState, minigameOf, sceneTexts, startRun } from './helpers';

// T-031: scripted, keyboard-driven mini-game runs. Timing assertions use `__PROXIMA__.minigame.elapsed` (fixed-step
// seconds of play), never the wall clock. `?debug=1` enables loadState and finishWith.

/** Wait until the run's fixed-step clock reaches `t` seconds. */
async function untilElapsed(page: Page, t: number): Promise<void> {
  await expect.poll(async () => (await minigameOf(page))?.elapsed ?? 0, { timeout: 20_000 }).toBeGreaterThanOrEqual(t);
}

/** Press-and-hold `key` until the run clock has advanced by `seconds`. */
async function holdFor(page: Page, key: string, seconds: number): Promise<void> {
  const from = (await minigameOf(page))!.elapsed;
  await page.keyboard.down(key);
  await untilElapsed(page, from + seconds);
  await page.keyboard.up(key);
}

/** Title -> Store -> Travel with a kit for every mini-game; real mini-games (no &minigames=auto). */
async function toTravel(page: Page, seed: string, query = '&debug=1'): Promise<void> {
  await startRun(page, seed, false, query);
  for (const [row, qty] of [[1, 3], [2, 2000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await leaveStore(page);
}

const startSalvage = async (page: Page): Promise<void> => {
  await page.keyboard.press('8'); // Scan for salvage
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Salvage');
  await page.keyboard.press('Space'); // leave the instruction screen
  await untilElapsed(page, 0.1);
};

const LUNAR = {
  seed: 'T031-LUNAR', day: 10, segment: 2, arrivedAt: 1, distanceInSegment: 0, window: 1, route: 'oort', offlineDrives: [],
  broken: { hull: false, pump: false, gyro: false }, justCrossedHazard: false, crossing: { waypoint: 1, density: 1, pilotDaysLeft: null },
};
const FLARE_BELT = {
  segment: 16, arrivedAt: 15, distanceInSegment: 0, offlineDrives: [], justCrossedHazard: false,
  broken: { hull: false, pump: false, gyro: false }, crossing: { waypoint: 15, density: 5, pilotDaysLeft: null },
};

test('(a) Salvage: scripted drone movement and one shot, then finishNow: result panel and a day', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toTravel(page, 'T031-SALV');
  const before = (await getState(page))!;
  await startSalvage(page);
  await page.keyboard.press('Space'); // fire once, facing right
  await holdFor(page, 'ArrowDown', 1.5);
  await holdFor(page, 'ArrowRight', 1.5);
  expect((await minigameOf(page))!.elapsed).toBeGreaterThanOrEqual(3);
  await page.evaluate(() => window.__PROXIMA__?.minigame?.finishNow());
  const m = (await minigameOf(page))!;
  expect(m.result).toMatchObject({ kind: 'salvage' });
  expect((m.result as { chargesUsed: number }).chargesUsed).toBeGreaterThanOrEqual(1);
  expect(await sceneTexts(page, 'Salvage')).toContain('Run complete');
  const after = (await getState(page))!;
  expect(after.day).toBe(before.day + 1);
  expect(after.supplies.charges).toBeLessThan(before.supplies.charges);
  expect(after.log.some((e) => e.kind === 'salvage')).toBe(true);
  expect(errors).toEqual([]);
});

test('(b) Threading via loadState: Thread it, scripted Up/Down, finishNow clears the crossing and logs threading', async ({ page }) => {
  await toTravel(page, 'T031-THREAD');
  await loadPatchedState(page, LUNAR);
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  expect((await getState(page))!.crossing).not.toBeNull();
  await page.waitForTimeout(150);
  await page.keyboard.press('1'); // Thread it
  await expect(body(page)).toHaveAttribute('data-scene', 'Threading');
  await page.keyboard.press('Enter');
  await untilElapsed(page, 0.1);
  for (let i = 0; i < 4; i++) await holdFor(page, i % 2 ? 'ArrowDown' : 'ArrowUp', 0.5);
  expect((await minigameOf(page))!.elapsed).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.__PROXIMA__?.minigame?.finishNow());
  // A clean run opens the bonus pick (nothing is sent until the pick); take +10 rations.
  if (await body(page).getAttribute('data-modal')) await page.keyboard.press('2');
  await expect.poll(async () => (await getState(page))!.crossing).toBeNull();
  const s = (await getState(page))!;
  expect(s.log.some((e) => e.kind === 'threading')).toBe(true);
  expect(s.day).toBe(10);
});

test('(c) Flare: a clean ride is "Rode the wind"; five hits is a crash', async ({ page }) => {
  await toTravel(page, 'T031-FLARE');
  const ride = async (): Promise<void> => {
    await loadPatchedState(page, FLARE_BELT);
    await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
    await page.waitForTimeout(150);
    await page.keyboard.press('1'); // Ride the solar wind
    await expect(body(page)).toHaveAttribute('data-scene', 'Flare');
    await page.keyboard.press('Enter');
    await untilElapsed(page, 0.1);
  };

  await ride();
  expect(await page.evaluate(() => window.__PROXIMA__?.minigame?.finishWith({ kind: 'flare', hits: 0 }))).toBeNull();
  const clean = (await getState(page))!;
  expect(clean.rodeTheWind).toBe(true);
  expect(clean.crossing).toBeNull();
  expect(clean.log.some((e) => e.kind === 'flare' && e.id === 'clean')).toBe(true);
  expect(await sceneTexts(page, 'Flare')).toContain('Rode the wind!');

  const aliveBefore = clean.crew.filter((c) => c.alive).length;
  await page.waitForTimeout(450);
  await page.keyboard.press('Enter'); // leave the panel
  await ride(); // loadPatchedState re-parks at the Belt (rodeTheWind stays from the live state; crash is what we check)
  expect(await page.evaluate(() => window.__PROXIMA__?.minigame?.finishWith({ kind: 'flare', hits: 5 }))).toBeNull();
  const crash = (await getState(page))!;
  expect(crash.log.some((e) => e.kind === 'flare' && e.id === 'crash')).toBe(true);
  expect(crash.crew.filter((c) => c.alive).length).toBe(aliveBefore - 1);
  expect(crash.broken.hull).toBe(true);
});

test('(d) Pause: Esc sets data-paused, the clock stands still, Resume clears it', async ({ page }) => {
  await toTravel(page, 'T031-PAUSE');
  await startSalvage(page);
  await untilElapsed(page, 0.5);
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-paused', '1');
  const frozen = (await minigameOf(page))!.elapsed;
  await page.waitForTimeout(600);
  expect((await minigameOf(page))!.elapsed).toBe(frozen);
  await page.keyboard.press('Enter'); // Resume
  await expect(body(page)).not.toHaveAttribute('data-paused', '1');
  await untilElapsed(page, frozen + 0.3);
});

test.describe('(e) touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 800, height: 450 } });

  test('Salvage shows the FIRE button and the pause icon', async ({ page }) => {
    await toTravel(page, 'T031-TOUCH', '&debug=1');
    await startSalvage(page);
    const texts = await sceneTexts(page, 'Salvage');
    expect(texts).toContain('FIRE');
    expect(texts).toContain('II');
  });
});

test('frame time: no long task (> 50 ms) during 5 s of a Salvage run', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __long: number[]; __longOk: boolean };
    w.__long = [];
    w.__longOk = false;
    try {
      if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        w.__longOk = true;
        new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ entryTypes: ['longtask'] });
      }
    } catch { /* unsupported */ }
  });
  await toTravel(page, 'T031-PERF');
  const supported = await page.evaluate(() => (window as unknown as { __longOk: boolean }).__longOk);
  test.skip(!supported, 'longtask entries are not available in this browser');
  await startSalvage(page);
  await page.evaluate(() => { (window as unknown as { __long: number[] }).__long.length = 0; });
  const from = (await minigameOf(page))!.elapsed;
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Space');
  await untilElapsed(page, from + 5);
  await page.keyboard.up('ArrowRight');
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  expect(long.filter((d) => d > 50), `long tasks (ms): ${long.join(', ')}`).toEqual([]);
});
