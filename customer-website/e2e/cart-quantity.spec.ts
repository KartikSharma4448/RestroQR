import { test, expect } from '@playwright/test';

for (const ordering of [true, false]) {
  test(`quantity limit in ${ordering ? 'table ordering' : 'browse selection'}`, async ({ page }, testInfo) => {
    const orders: unknown[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/api/public/orders' && request.method() === 'POST') {
        orders.push(request.postDataJSON());
        return route.fulfill({ status: 201, json: { success: true, data: {
          orderRef: 'ORD-SAMPLE', total: '1000.00', items: [{ name: 'Sample Tea', price: '10.00', quantity: 100 }],
        } } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true, data: [] } });
      if (url.origin === 'http://127.0.0.1:3107') return route.continue();
      return route.abort();
    });
    await page.goto(`/r/receipt-test${ordering ? '/t/sample-table' : ''}`);
    await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
    const menuIncrease = page.getByRole('button', { name: 'Increase quantity of Sample Tea', exact: true });
    // Rapid queued additions exercise the shared state limit, not just disabled styling.
    await menuIncrease.evaluate((button: HTMLButtonElement) => {
      for (let index = 0; index < 200; index++) button.click();
    });
    await expect(menuIncrease).toBeDisabled();
    await expect(menuIncrease).toHaveAttribute('title', 'Maximum quantity: 100');
    await expect(menuIncrease.locator('..').locator('[aria-live]')).toHaveText('100');

    await page.getByRole('button', { name: ordering ? /Review & Place Order/ : /View Selection/ }).click();
    const dialog = page.getByRole('dialog', { name: ordering ? 'Review your order' : 'Review your selection' });
    const increase = dialog.getByRole('button', { name: 'Increase Sample Tea', exact: true });
    const decrease = dialog.getByRole('button', { name: 'Decrease Sample Tea', exact: true });
    const total = dialog.getByText('Total Amount', { exact: true }).locator('../..');
    await expect(increase).toBeDisabled();
    await expect(total).toContainText('\u20b91,000');
    await decrease.click();
    await expect(increase).toBeEnabled();
    await expect(total).toContainText('\u20b9990');
    await increase.click();
    await expect(increase).toBeDisabled();
    await expect(total).toContainText('\u20b91,000');
    await page.screenshot({ path: testInfo.outputPath('quantity-limit.png'), animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    if (ordering) {
      await dialog.getByRole('button', { name: 'Place Order', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Order confirmation' })).toBeVisible();
      expect(orders).toEqual([{ tableToken: 'sample-table', items: [{ itemId: '11111111-1111-4111-8111-111111111111', quantity: 100 }] }]);
      await page.getByRole('button', { name: 'Order More Dishes' }).click();
    } else {
      // Removing the last unit hides the selection; it can then start again at one.
      await decrease.evaluate((button: HTMLButtonElement) => {
        for (let index = 0; index < 100; index++) button.click();
      });
      await expect(dialog).toHaveCount(0);
      expect(orders).toEqual([]);
    }
    await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
    await expect(menuIncrease).toBeEnabled();
    await expect(menuIncrease.locator('..').locator('[aria-live]')).toHaveText('1');
    expect(errors).toEqual([]);
  });
}

for (const ordering of [true, false]) {
  test(`50 distinct dishes limit in ${ordering ? 'table ordering' : 'browse selection'}`, async ({ page }) => {
    const orders: { items: { itemId: string; quantity: number }[] }[] = [];
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/api/public/orders' && request.method() === 'POST') {
        const order = request.postDataJSON();
        orders.push(order);
        return route.fulfill({ status: 201, json: { success: true, data: {
          orderRef: 'ORD-SAMPLE', total: '510.00', items: order.items.map((item: { quantity: number }) => ({
            name: 'Sample Dish', price: '10.00', quantity: item.quantity,
          })),
        } } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true, data: [] } });
      if (url.origin === 'http://127.0.0.1:3107') return route.continue();
      return route.abort();
    });
    await page.goto(`/r/large-menu${ordering ? '/t/sample-table' : ''}`);
    await expect(page.getByRole('button', { name: /^Add Dish / })).toHaveCount(51);
    // Queue every add in one burst to verify the shared state guard rejects row 51.
    await page.getByRole('button', { name: /^Add Dish / }).evaluateAll(buttons => {
      for (const button of buttons) (button as HTMLButtonElement).click();
    });
    const blocked = page.getByRole('button', { name: 'Add Dish 51', exact: true });
    await expect(blocked).toBeDisabled();
    await expect(blocked).toHaveAttribute('title', 'Maximum 50 different dishes per order');
    await expect(page.getByRole('button', { name: /^Increase quantity of Dish / })).toHaveCount(50);
    // Increasing an existing row is allowed even when all 50 row slots are occupied.
    await page.getByRole('button', { name: 'Increase quantity of Dish 1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Increase quantity of Dish 1', exact: true }).locator('..').locator('[aria-live]')).toHaveText('2');
    await page.getByRole('button', { name: 'Decrease quantity of Dish 2', exact: true }).click();
    await expect(blocked).toBeEnabled();
    await blocked.click();
    await expect(page.getByRole('button', { name: 'Add Dish 2', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: ordering ? /Review & Place Order/ : /View Selection/ }).click();
    const dialog = page.getByRole('dialog', { name: ordering ? 'Review your order' : 'Review your selection' });
    await expect(dialog.getByRole('button', { name: /^Increase Dish / })).toHaveCount(50);
    await expect(dialog.getByText('Total Amount', { exact: true }).locator('../..')).toContainText('\u20b9510');
    if (ordering) {
      await dialog.getByRole('button', { name: 'Place Order', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Order confirmation' })).toBeVisible();
      expect(orders).toHaveLength(1);
      expect(orders[0].items).toHaveLength(50);
      expect(new Set(orders[0].items.map(item => item.itemId)).size).toBe(50);
      expect(orders[0].items.reduce((sum, item) => sum + item.quantity, 0)).toBe(51);
      await page.getByRole('button', { name: 'Order More Dishes' }).click();
      await expect(page.getByRole('button', { name: /^Add Dish / })).toHaveCount(51);
      await expect(page.getByRole('button', { name: 'Add Dish 2', exact: true })).toBeEnabled();
    } else {
      expect(orders).toHaveLength(0);
    }
  });
}
