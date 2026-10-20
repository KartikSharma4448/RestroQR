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
  await page.route('**/api/public/order-board/**', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            orderRef: 'ORD-CAFE01',
            tableName: 'Table 04',
            customerName: 'K.',
            status: 'accepted',
          },
        ],
      },
    }),
  );
  await page.route('**/api/public/waiter-calls/status', (route) =>
    route.fulfill({ json: { data: { call: null } } }),
  );
});
test('cafe cover, menu navigation, filters and cart stay usable', async ({
  page,
}) => {
  await page.goto('/r/cafe-redesign/t/test-table');
  await expect(
    page.getByRole('heading', { name: 'Willow & Stone Cafe', exact: true }),
  ).toBeVisible();
  const cover = page.getByRole('img', {
    name: 'Willow & Stone Cafe restaurant cover',
  });
  await expect(cover).toBeVisible();
  expect(
    await cover.evaluate((el: HTMLImageElement) => el.naturalWidth > 100),
  ).toBe(true);
  const menuHeading = page.getByRole('heading', {
    name: 'Our menu',
    exact: true,
  });
  await expect(menuHeading).toBeVisible();
  expect((await menuHeading.boundingBox())!.y).toBeLessThan(
    page.viewportSize()!.height,
  );
  await page.screenshot({
    path: test.info().outputPath('cafe-first-viewport.png'),
  });
  await page.getByRole('link', { name: 'Order food', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Add Grilled sourdough sandwich',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', { name: /Review & Place Order/ }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Coffee & coolers',exact:true }).click();
  await expect(
    page.getByRole('heading', { name: 'Coffee & coolers', exact: true }),
  ).toBeInViewport();
  await page
    .getByPlaceholder('Search dishes, drinks, desserts...')
    .fill('cappuccino');
  await expect(
    page.getByRole('heading', { name: 'Classic cappuccino', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Grilled sourdough sandwich',
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Grilled sourdough sandwich',
      exact: true,
    }),
  ).toBeAttached();
  await page.getByRole('button', { name: 'Live orders', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Live orders', exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole('cell', { name: 'ORD-CAFE01', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath('cafe-full-menu.png'),
    fullPage: true,
  });
});
test('long restaurant names, no-cover and failed-cover states fit a small phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/r/cafe-long-name');
  await expect(
    page.getByRole('heading', {
      name: 'The Little Neighbourhood Coffeehouse & All-Day Kitchen',
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath('cafe-long-name.png') });
  await page.route(
    (url) =>
      url.pathname === '/screenshots/cafe-hero.png' ||
      (url.pathname === '/_next/image' &&
        url.searchParams.get('url') === '/screenshots/cafe-hero.png'),
    (route) => route.abort(),
  );
  await page.goto('/r/cafe-redesign');
  await expect(page.locator('.cafe-masthead')).toHaveClass(/no-cover/);
  await expect(
    page.getByRole('heading', { name: 'Willow & Stone Cafe', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
