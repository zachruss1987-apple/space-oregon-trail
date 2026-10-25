import { expect, test, type Page } from '@playwright/test';
import { body, buy, getState, idle, leaveStore, sceneTexts, snap, startRun } from './helpers';

// minigames.md section 1 + the UI contract: Travel 8 = Scan for salvage, confirm Yes, the Salvage scene opens on its
// instruction screen, Space starts, `__PROXIMA__.minigame.finishNow()` ends the run, Enter returns to Travel.

/** Title -> Store with a few charge boxes, then Travel. */
async function runWithCharges(page: Page, seed: string): Promise<void> {
  await startRun(page, seed);
  for (const [row, qty] of [[1, 3], [2, 1500], [4, 3]] as const) await buy(page, row, qty);
  await leaveStore(page);
  await idle(page);
}

const minigame = (page: Page) => page.evaluate(() => {
  const m = window.__PROXIMA__?.minigame;
  return m ? { kind: m.kind, elapsed: m.elapsed, result: m.result ?? null } : null;
});

test('Scan launches the Salvage Run; finishNow returns a result that costs a day and charges', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await runWithCharges(page, 'SALVAGE1');
  const before = (await getState(page))!;
  expect(before.seed).toBe('SALVAGE1');
  expect(await minigame(page)).toBeNull();

  await page.keyboard.press('8');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.keyboard.press('Enter'); // Yes: launch the drone
  await expect(body(page)).toHaveAttribute('data-scene', 'Salvage');
  await expect(body(page)).toHaveAttribute('data-minigame', 'salvage');
  expect(await sceneTexts(page, 'Salvage')).toContain('SALVAGE RUN');
  expect(await minigame(page)).toMatchObject({ kind: 'salvage', elapsed: 0, result: null });
  await snap(page, 'Salvage-instructions');

  await page.keyboard.press('Space'); // start: countdown, then play
  await expect.poll(async () => (await minigame(page))?.elapsed ?? 0, { timeout: 5000 }).toBeGreaterThan(0.1);
  await page.keyboard.press('Space'); // one grapple shot (1 charge, hit or miss)
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await snap(page, 'Salvage-play');

  // Esc pauses (body[data-paused]); Resume with Enter.
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-paused', '1');
  const paused = (await minigame(page))!.elapsed;
  await page.waitForTimeout(300);
  expect((await minigame(page))!.elapsed).toBe(paused);
  await page.keyboard.press('Enter');
  await expect(body(page)).not.toHaveAttribute('data-paused', '1');

  await page.evaluate(() => window.__PROXIMA__?.minigame?.finishNow());
  const m = (await minigame(page))!;
  expect(m.elapsed).toBeCloseTo(40, 1);
  expect(m.result).toMatchObject({ kind: 'salvage', chargesUsed: 1 });
  expect(await sceneTexts(page, 'Salvage')).toContain('Run complete');
  await snap(page, 'Salvage-result');

  const after = (await getState(page))!;
  expect(after.day).toBe(before.day + 1);
  expect(after.supplies.charges).toBe(before.supplies.charges - 1);
  expect(after.log.some((e) => e.kind === 'salvage')).toBe(true);

  await page.waitForTimeout(450);
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  await expect(body(page)).not.toHaveAttribute('data-minigame', 'salvage');
  expect(await minigame(page)).toBeNull();
  expect((await getState(page))!.day).toBe(before.day + 1);
  expect(errors).toEqual([]);
});

test('Skip from the pause menu resolves with the penalty and logs info/skipped', async ({ page }) => {
  await runWithCharges(page, 'SALVAGE2');
  const before = (await getState(page))!;
  await page.keyboard.press('8');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Salvage');
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-paused', '1');
  await page.keyboard.press('2'); // Skip (penalty)
  await page.keyboard.press('2'); // confirm: Skip it
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  const after = (await getState(page))!;
  expect(after.day).toBe(before.day + 1);
  expect(after.supplies.charges).toBe(before.supplies.charges - 5);
  expect(after.log.some((e) => e.kind === 'info' && e.id === 'skipped')).toBe(true);
});
