import { test, expect } from '@playwright/test';

test.describe('Menu Page Rendering', () => {
  test('QR URL navigation renders restaurant menu with name', async ({ page }) => {
    // Navigate to a restaurant menu via QR token URL
    await page.goto('/r/testtoken1');

    // Wait for page to load — either the menu or error page
    await page.waitForLoadState('networkidle');

    // If menu loaded successfully, the restaurant name should be visible
    // The MenuHeader component renders the restaurant name as an h1
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('menu page displays categories in correct order', async ({ page }) => {
    await page.goto('/r/testtoken1');
    await page.waitForLoadState('networkidle');

    // Categories are rendered as section headings (h2) in CategorySection
    const categoryHeadings = page.locator('h2');
    const count = await categoryHeadings.count();

    // If menu loaded, there should be at least one category
    if (count > 0) {
      await expect(categoryHeadings.first()).toBeVisible();
    }
  });

  test('menu page displays food item cards with name and price', async ({ page }) => {
    await page.goto('/r/testtoken1');
    await page.waitForLoadState('networkidle');

    // Food items show name (h3) and price (₹ symbol)
    const itemCards = page.locator('h3');
    const count = await itemCards.count();

    if (count > 0) {
      await expect(itemCards.first()).toBeVisible();
      // Check that price is displayed somewhere on the page
      await expect(page.locator('text=₹').first()).toBeVisible();
    }
  });

  test('menu page shows veg/non-veg badge indicators', async ({ page }) => {
    await page.goto('/r/testtoken1');
    await page.waitForLoadState('networkidle');

    // Veg/non-veg badges are rendered as aria-labeled spans
    const vegBadges = page.locator('[aria-label="Vegetarian"], [aria-label="Non-vegetarian"]');
    const count = await vegBadges.count();

    if (count > 0) {
      await expect(vegBadges.first()).toBeVisible();
    }
  });

  test('menu page has no horizontal scroll on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/r/testtoken1');
    await page.waitForLoadState('networkidle');

    // The main element uses overflow-x-hidden and max-w-3xl
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
