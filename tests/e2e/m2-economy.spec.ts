import { expect, test } from '@playwright/test';
import { body, generousRun, getState, idle, reachWaypoint, sceneTexts } from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS } from './seeds';

// economy.md: sell price is at most 90% of the Independence price (a nav gyro is 10 cr there); Trade, Talk, Rest here.
test('Mars Relay: sell a gyro, trade, talk, rest 2 days', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await generousRun(page, FAST_FIRST_WAYPOINT_SEEDS[0] as string);
  await reachWaypoint(page, 3);
  await page.keyboard.press('2'); // Enter station
  await expect(body(page)).toHaveAttribute('data-scene', 'Station');
  await page.waitForTimeout(600);

  // Outfitters: row 7 = nav gyros; modal Buy / Sell / Back; 2 = Sell; quantity 1.
  await page.keyboard.press('1');
  if (((await getState(page))?.supplies.gyros ?? 0) === 0) {
    // The run may have used its spare gyro on a repair; buy one first (modal 1 = Buy).
    await page.keyboard.press('7');
    await expect(body(page)).toHaveAttribute('data-modal', '1');
    await page.keyboard.press('1');
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await getState(page))?.supplies.gyros).toBe(1);
    await idle(page);
  }
  const before = (await getState(page))!;
  await page.keyboard.press('7');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.keyboard.press('2');
  await page.keyboard.type('1');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getState(page))?.supplies.gyros).toBe(before.supplies.gyros - 1);
  const sold = (await getState(page))!;
  const gain = sold.credits - before.credits;
  expect(gain).toBeGreaterThanOrEqual(1);
  expect(gain).toBeLessThanOrEqual(9);
  expect(sold.log.some((e) => e.kind === 'store' && e.id === 'gyros')).toBe(true);
  await idle(page);
  await page.keyboard.press('Escape'); // back to the station menu

  // Trade: accept the first offer if any, else the empty-offer copy.
  await page.keyboard.press('2');
  await page.waitForTimeout(300);
  const offers = sold.station?.offers ?? [];
  if (offers.length > 0) {
    await page.keyboard.press('1'); // first offer -> Accept / Decline modal
    await expect(body(page)).toHaveAttribute('data-modal', '1');
    await page.keyboard.press('Enter'); // Accept
    await expect.poll(async () => JSON.stringify([(await getState(page))?.supplies, (await getState(page))?.credits])).not.toBe(
      JSON.stringify([sold.supplies, sold.credits]),
    );
    const traded = (await getState(page))!;
    expect(traded.station?.offers[0]?.taken).toBe(true);
    expect(traded.log.some((e) => e.kind === 'trade')).toBe(true);
    await idle(page);
    await expect(body(page)).not.toHaveAttribute('data-modal', '1');
  } else {
    expect((await sceneTexts(page, 'Station')).join('\n')).toContain('Nobody here wants to trade.');
  }
  await page.keyboard.press('Escape');

  // Talk shows a line (the speech box changes from the menu hint).
  const hint = (await sceneTexts(page, 'Station')).join('|');
  await page.keyboard.press('3');
  await page.waitForTimeout(1500);
  const talk = (await sceneTexts(page, 'Station')).join('|');
  expect(talk).not.toBe(hint);

  // Rest here 2 days.
  const day = (await getState(page))!.day;
  await page.keyboard.press('4');
  await page.keyboard.type('2');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getState(page))?.day, { timeout: 20_000 }).toBe(day + 2);
  expect(errors).toEqual([]);
});
