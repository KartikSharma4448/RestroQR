import { test, expect } from '@playwright/test';

test.describe('Error Page Handling', () => {
  test('invalid token redirects to error page', async ({ page }) => {
    // Navigate to an invalid/non-existent token
    await page.goto('/r/invalidtoken999');
    await page.waitForLoadState('networkidle');

    // The app redirects to /error for invalid tokens
    // Check that error page content is displayed
    const heading = page.locator('h1');
    await expect(heading).toContainText('Menu Unavailable');
  });

  test('error page displays descriptive message', async ({ page }) => {
    await page.goto('/error');
    await page.waitForLoadState('networkidle');

    // Check heading
    await expect(page.locator('h1')).toContainText('Menu Unavailable');

    // Check description text
    await expect(
      page.locator('text=currently unavailable'),
    ).toBeVisible();
  });

  test('error page has Go Back button', async ({ page }) => {
    await page.goto('/error');
    await page.waitForLoadState('networkidle');

    const goBackButton = page.locator('button', { hasText: 'Go Back' });
    await expect(goBackButton).toBeVisible();
  });

  test('error page has Try Again button', async ({ page }) => {
    await page.goto('/error');
    await page.waitForLoadState('networkidle');

    const tryAgainButton = page.locator('button', { hasText: 'Try Again' });
    await expect(tryAgainButton).toBeVisible();
  });

  test('error page shows RestroQR branding', async ({ page }) => {
    await page.goto('/error');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Powered by RestroQR')).toBeVisible();
  });

  test('error page does not leak internal information', async ({ page }) => {
    await page.goto('/error');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();

    // Should not contain UUIDs
    expect(bodyText).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    // Should not contain stack traces
    expect(bodyText).not.toMatch(/at\s+\w+\s*\(/);
    // Should not contain database field names
    expect(bodyText).not.toContain('restaurant_token');
    expect(bodyText).not.toContain('owner_id');
    expect(bodyText).not.toContain('password_hash');
  });

  test('unavailable item shows visual indicator', async ({ page }) => {
    // Navigate to a menu page that has unavailable items
    await page.goto('/r/testtoken1');
    await page.waitForLoadState('networkidle');

    // Look for the "Unavailable" badge text rendered by UnavailableBadge component
    const unavailableBadges = page.locator('text=Unavailable');
    const count = await unavailableBadges.count();

    // If there are unavailable items, they should show the badge
    if (count > 0) {
      await expect(unavailableBadges.first()).toBeVisible();
    }

    // Items with is_available=false should have reduced opacity
    // The FoodItemCard applies opacity-60 class when unavailable
    const fadedCards = page.locator('.opacity-60');
    const fadedCount = await fadedCards.count();

    // The number of faded cards should match the unavailable badges
    expect(fadedCount).toBe(count);
  });
});
