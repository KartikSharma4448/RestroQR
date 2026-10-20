import { expect, test } from '@playwright/test';

test('dish emoji is visible without changing cart or price', async ({ page }) => {
  await page.goto('/r/emoji-menu');
  await expect(page.getByRole('img', { name: 'Sample Tea illustration' })).toHaveText('\u{2615}');
  await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Decrease quantity of Sample Tea' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('menu-emoji.png'), fullPage: true });
});
