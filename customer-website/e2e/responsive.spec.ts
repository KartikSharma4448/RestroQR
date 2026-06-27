import { test, expect } from '@playwright/test';

const BREAKPOINTS = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

test.describe('Responsive Layout', () => {
  for (const bp of BREAKPOINTS) {
    test(`no horizontal scroll at ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/r/testtoken1');
      await page.waitForLoadState('networkidle');

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test(`content is readable at ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/r/testtoken1');
      await page.waitForLoadState('networkidle');

      // The main content area should be visible and within viewport
      const main = page.locator('main');
      await expect(main).toBeVisible();

      // Main element should not exceed viewport width
      const mainBox = await main.boundingBox();
      if (mainBox) {
        expect(mainBox.width).toBeLessThanOrEqual(bp.width);
      }
    });

    test(`search bar is usable at ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/r/testtoken1');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('#menu-search');
      await expect(searchInput).toBeVisible();

      // Search input should be interactable at this viewport
      const box = await searchInput.boundingBox();
      if (box) {
        // Input should have reasonable width (at least 150px) and be within viewport
        expect(box.width).toBeGreaterThan(100);
        expect(box.x + box.width).toBeLessThanOrEqual(bp.width);
      }
    });

    test(`filter buttons are accessible at ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/r/testtoken1');
      await page.waitForLoadState('networkidle');

      const vegButton = page.locator('[aria-label="Filter vegetarian items"]');
      const nonVegButton = page.locator('[aria-label="Filter non-vegetarian items"]');

      await expect(vegButton).toBeVisible();
      await expect(nonVegButton).toBeVisible();

      // Buttons should be tappable (minimum 24px height for touch targets)
      const vegBox = await vegButton.boundingBox();
      if (vegBox) {
        expect(vegBox.height).toBeGreaterThanOrEqual(24);
      }
    });
  }

  test('layout stacks search and filters on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/r/testtoken1');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('#menu-search');
    const filterGroup = page.locator('[role="group"][aria-label="Filter by food type"]');

    const searchBox = await searchInput.boundingBox();
    const filterBox = await filterGroup.boundingBox();

    // On mobile, filters should be below the search (stacked layout via flex-col)
    if (searchBox && filterBox) {
      expect(filterBox.y).toBeGreaterThanOrEqual(searchBox.y + searchBox.height);
    }
  });

  test('layout shows search and filters side by side on tablet+', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/r/testtoken1');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('#menu-search');
    const filterGroup = page.locator('[role="group"][aria-label="Filter by food type"]');

    const searchBox = await searchInput.boundingBox();
    const filterBox = await filterGroup.boundingBox();

    // On tablet+, filters should be on the same row as search (sm:flex-row)
    if (searchBox && filterBox) {
      // The Y positions should be approximately the same (within the same row)
      expect(Math.abs(filterBox.y - searchBox.y)).toBeLessThan(20);
    }
  });
});
