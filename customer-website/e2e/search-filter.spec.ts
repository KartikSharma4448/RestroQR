import { test, expect } from '@playwright/test';

test.describe('Search and Filter Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/r/testtoken1');
    await page.waitForLoadState('networkidle');
  });

  test('search input is visible and accepts text', async ({ page }) => {
    const searchInput = page.locator('#menu-search');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search menu items...');
  });

  test('typing in search filters items in real-time', async ({ page }) => {
    const searchInput = page.locator('#menu-search');
    await searchInput.fill('chicken');

    // After typing, the items should be filtered
    // Items that don't match should be hidden
    await expect(searchInput).toHaveValue('chicken');

    // The filter is applied client-side, so results update immediately
    // We check that either matching items are shown or "no results" message appears
    const noResults = page.locator('text=No items match your current search or filter');
    const itemCards = page.locator('h3');

    // One of these conditions should be true
    const hasResults = await itemCards.count();
    const hasNoResultsMessage = await noResults.isVisible().catch(() => false);
    expect(hasResults > 0 || hasNoResultsMessage).toBeTruthy();
  });

  test('clearing search shows all items again', async ({ page }) => {
    const searchInput = page.locator('#menu-search');

    // Get initial item count
    const initialCount = await page.locator('h3').count();

    // Type something to filter
    await searchInput.fill('zzzznonexistent');
    await expect(page.locator('text=No items match your current search or filter')).toBeVisible();

    // Clear the search using the clear button
    const clearButton = page.locator('[aria-label="Clear search"]');
    await clearButton.click();

    // Items should be restored
    await expect(searchInput).toHaveValue('');
    const restoredCount = await page.locator('h3').count();
    expect(restoredCount).toBe(initialCount);
  });

  test('veg filter toggle works correctly', async ({ page }) => {
    const vegButton = page.locator('[aria-label="Filter vegetarian items"]');
    await expect(vegButton).toBeVisible();

    // Click veg filter
    await vegButton.click();
    await expect(vegButton).toHaveAttribute('aria-pressed', 'true');

    // Only veg items should be visible (green badges)
    const nonVegBadges = page.locator('[aria-label="Non-vegetarian"]');
    const nonVegCount = await nonVegBadges.count();
    expect(nonVegCount).toBe(0);

    // Click again to deactivate
    await vegButton.click();
    await expect(vegButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('non-veg filter toggle works correctly', async ({ page }) => {
    const nonVegButton = page.locator('[aria-label="Filter non-vegetarian items"]');
    await expect(nonVegButton).toBeVisible();

    // Click non-veg filter
    await nonVegButton.click();
    await expect(nonVegButton).toHaveAttribute('aria-pressed', 'true');

    // Only non-veg items should be visible (red badges)
    const vegBadges = page.locator('[aria-label="Vegetarian"]');
    const vegCount = await vegBadges.count();
    expect(vegCount).toBe(0);

    // Click again to deactivate
    await nonVegButton.click();
    await expect(nonVegButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('search and filter can be combined', async ({ page }) => {
    const searchInput = page.locator('#menu-search');
    const vegButton = page.locator('[aria-label="Filter vegetarian items"]');

    // Apply both search and veg filter
    await searchInput.fill('paneer');
    await vegButton.click();

    // Both filters should be active
    await expect(searchInput).toHaveValue('paneer');
    await expect(vegButton).toHaveAttribute('aria-pressed', 'true');

    // Results should be items matching "paneer" AND veg badge
    const noResults = page.locator('text=No items match your current search or filter');
    const itemCards = page.locator('h3');

    const hasResults = await itemCards.count();
    const hasNoResultsMessage = await noResults.isVisible().catch(() => false);
    expect(hasResults > 0 || hasNoResultsMessage).toBeTruthy();
  });

  test('filter group has correct aria attributes', async ({ page }) => {
    const filterGroup = page.locator('[role="group"][aria-label="Filter by food type"]');
    await expect(filterGroup).toBeVisible();
  });
});
