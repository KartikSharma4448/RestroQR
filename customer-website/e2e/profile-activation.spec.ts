import { test, expect } from '@playwright/test';

test('incomplete profile stays browseable but cannot start order checkout', async ({ page }, info) => {
  let orderRequests = 0;
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/public/orders') {
      orderRequests++;
      return route.abort();
    }
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    return route.abort();
  });
  await page.goto('/r/pending-profile/t/sample-table');
  await expect(page.getByRole('status').filter({hasText:'not accepting new orders'})).toBeVisible();
  await expect(page.getByText('Sample Tea', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
  await expect(page.getByRole('button', { name: /Review & Place Order/ })).toHaveCount(0);
  expect(orderRequests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('pending-profile.png'), fullPage: true });
});
