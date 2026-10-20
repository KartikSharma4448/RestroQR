import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/public/engagement/**', (route) =>
    route.fulfill({
      json: {
        data: {
          loyalty: null,
          reviewsEnabled: true,
          reviews: [],
          summary: { count: 0, average: null },
          payment: null,
        },
      },
    }),
  );
  await page.route('**/api/public/waiter-calls/status', (route) =>
    route.fulfill({ json: { data: { call: null } } }),
  );
});
test('category and food-type tabs filter instead of scrolling, and All restores menu', async ({
  page,
}) => {
  await page.goto('/r/cafe-redesign/t/test-table');
  const categories = page.getByRole('tablist', { name: 'Menu categories' });
  const type = page.getByRole('group', { name: 'Filter by food type' });
  await expect(
    categories.getByRole('tab', { name: 'All', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('article')).toHaveCount(6);
  await page
    .getByRole('button', {
      name: 'Add Grilled sourdough sandwich',
      exact: true,
    })
    .click();
  await categories
    .getByRole('tab', { name: 'Coffee & coolers', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(
    page.getByRole('heading', {
      name: 'Grilled sourdough sandwich',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    categories.getByRole('tab', { name: 'Coffee & coolers', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await type
    .getByRole('button', { name: 'Filter vegetarian items', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await type
    .getByRole('button', { name: 'Filter non-vegetarian items', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'No dishes found' }),
  ).toBeVisible();
  await expect(
    categories.getByRole('tab', { name: 'Coffee & coolers', exact: true }),
  ).toBeVisible();
  await type
    .getByRole('button', { name: 'All food types', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await categories.getByRole('tab', { name: 'All', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
  await expect(
    page.getByRole('button', {
      name: 'Decrease quantity of Grilled sourdough sandwich',
    }),
  ).toBeVisible();
  await categories.getByRole('tab', { name: 'All', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    categories.getByRole('tab', { name: 'All-day brunch', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.keyboard.press('End');
  await expect(
    categories.getByRole('tab', { name: 'Something sweet', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('article')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath('category-tabs.png') });
});
test('Live orders beside Pay opens a single live panel and closes when ordering', async ({
  page,
}) => {
  let loads = 0;
  await page.route('**/api/public/order-board/**', (route) => {
    loads++;
    return route.fulfill({
      json: {
        data: [
          {
            orderRef: 'ORD-TABS01',
            tableName: 'Table 2',
            customerName: 'K.',
            status: 'accepted',
          },
        ],
      },
    });
  });
  await page.goto('/r/cafe-redesign/t/test-table');
  const services = page.getByRole('region', { name: 'Restaurant services' });
  const pay = services.getByRole('button', { name: 'Pay', exact: true });
  const live = services.getByRole('button', {
    name: 'Live orders',
    exact: true,
  });
  await expect(
    page.getByRole('heading', { name: 'Live orders', exact: true }),
  ).toHaveCount(0);
  const payBox = (await pay.boundingBox())!,
    liveBox = (await live.boundingBox())!;
  expect(liveBox.x).toBeGreaterThan(payBox.x);
  expect(liveBox.y).toBe(payBox.y);
  await live.click();
  await expect(live).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('cell', { name: 'ORD-TABS01', exact: true }),
  ).toBeVisible();
  expect(loads).toBeGreaterThan(0);
  await expect(page.locator('#live-orders')).toHaveCount(1);
  await page.screenshot({
    path: test.info().outputPath('live-orders-tab.png'),
  });
  await services.getByRole('link', { name: 'Order food', exact: true }).click();
  await expect(live).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#live-orders')).toHaveCount(0);
});
