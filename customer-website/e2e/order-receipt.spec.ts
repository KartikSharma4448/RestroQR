import { test, expect } from '@playwright/test';

const cases = [
  { name: 'single unit', items: [{ name: 'Sample Tea', price: '125.00', quantity: 1 }], total: '125.00', amounts: ['125'] },
  { name: 'multiple units', items: [{ name: 'Sample Tea', price: '125.00', quantity: 3 }], total: '375.00', amounts: ['375'] },
  { name: 'fractional price', items: [{ name: 'Sample Tea', price: '19.95', quantity: 3 }], total: '59.85', amounts: ['59.85'] },
  { name: 'mixed items', items: [{ name: 'Sample Tea', price: '125.00', quantity: 2 }, { name: 'Sample Snack', price: '49.50', quantity: 3 }], total: '398.50', amounts: ['250', '148.5'] },
  { name: 'zero price', items: [{ name: 'Sample Tea', price: '0.00', quantity: 2 }], total: '0.00', amounts: ['0'] },
];

for (const scenario of cases) {
  test(`receipt shows line totals: ${scenario.name}`, async ({ page }, testInfo) => {
    const browserErrors: string[] = [];
    const orders: unknown[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/api/public/orders' && request.method() === 'POST') {
        orders.push(request.postDataJSON());
        return route.fulfill({ status: 201, json: {
          success: true, data: { orderRef: 'ORD-SAMPLE', status: 'pending', total: scenario.total, items: scenario.items },
        } });
      }
      if (url.pathname.startsWith('/api/')) {
        return route.fulfill({ status: 200, json: { success: true, data: [] } });
      }
      if (url.origin === 'http://127.0.0.1:3107') return route.continue();
      return route.abort();
    });

    await page.goto('/r/receipt-test/t/sample-table');
    await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
    await page.getByRole('button', { name: /Review & Place Order/ }).click();
    await page.getByRole('button', { name: 'Place Order', exact: true }).click();

    const receipt = page.getByRole('dialog', { name: 'Order confirmation' });
    await expect(receipt).toBeVisible();
    for (const [index, item] of scenario.items.entries()) {
      const row = receipt.locator('div').filter({ has: page.getByText(item.name, { exact: false }) });
      const line = row.filter({ hasText: `\u00d7 ${item.quantity}` }).last();
      await expect(line).toContainText(`\u20b9${scenario.amounts[index]}`);
    }
    const totalRow = receipt.getByText('Total Amount', { exact: true }).locator('..');
    await expect(totalRow).toContainText(`\u20b9${Number(scenario.total).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    expect(orders).toEqual([{ tableToken: 'sample-table', items: [{ itemId: '11111111-1111-4111-8111-111111111111', quantity: 1 }] }]);
    expect(browserErrors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (scenario.name === 'mixed items') {
      await page.screenshot({ path: testInfo.outputPath('receipt.png') });
    }
    await receipt.getByRole('button', { name: 'Order More Dishes' }).click();
    await expect(receipt).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Review & Place Order/ })).toHaveCount(0);
  });
}

test('customer name is optional, trimmed and cleared after success', async ({ page }, testInfo) => {
  const orders: { customerName?: string }[] = [];
  const board = [{ orderRef: 'ORD-SAMPLE', tableName: 'Table 1', customerName: 'K. S.', status: 'pending' }];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/public/orders' && request.method() === 'POST') {
      orders.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: { success: true, data: {
        orderRef: 'ORD-SAMPLE', total: '10.00', items: [{ name: 'Sample Tea', price: '10.00', quantity: 1 }],
      } } });
    }
    if (url.pathname.startsWith('/api/')) {
      return route.fulfill({ json: { success: true, data: board } });
    }
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    return route.abort();
  });
  await page.goto('/r/receipt-test/t/sample-table');
  await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
  await page.getByRole('button', { name: /Review & Place Order/ }).click();
  const name = page.getByLabel('Your name');
  await expect(name).toHaveAttribute('maxlength', '100');
  await expect(name).toHaveAccessibleDescription('Shared with the restaurant. Only your initials appear on the public order board.');
  await name.fill('  Kartik Sharma  ');
  await page.screenshot({ path: testInfo.outputPath('checkout-name.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Place Order', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Order confirmation' })).toBeVisible();
  expect(orders[0].customerName).toBe('Kartik Sharma');
  await page.getByRole('button', { name: 'Order More Dishes' }).click();
  await expect(page.getByRole('cell', { name: 'K. S.', exact: true })).toBeVisible();
  await expect(page.getByText('Kartik Sharma', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
  await page.getByRole('button', { name: /Review & Place Order/ }).click();
  await expect(name).toHaveValue('');
  await name.fill('   ');
  await page.getByRole('button', { name: 'Place Order', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Order confirmation' })).toBeVisible();
  expect(orders[1]).not.toHaveProperty('customerName');
});

test('failed order preserves customer name and retry sends it', async ({ page }) => {
  const orders: { customerName?: string }[] = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/public/orders' && request.method() === 'POST') {
      orders.push(request.postDataJSON());
      if (orders.length === 1) return route.fulfill({ status: 400, json: { error: { message: 'Please try again.' } } });
      return route.fulfill({ status: 201, json: { success: true, data: {
        orderRef: 'ORD-SAMPLE', total: '10.00', items: [{ name: 'Sample Tea', price: '10.00', quantity: 1 }],
      } } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true, data: [] } });
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    return route.abort();
  });
  await page.goto('/r/receipt-test/t/sample-table');
  await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
  await page.getByRole('button', { name: /Review & Place Order/ }).click();
  const name = page.getByLabel('Your name');
  await name.fill('Sample Guest');
  await page.getByRole('button', { name: 'Place Order', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Review your order' }).getByRole('alert')).toContainText('Please try again.');
  await expect(name).toHaveValue('Sample Guest');
  await page.getByRole('button', { name: 'Place Order', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Order confirmation' })).toBeVisible();
  expect(orders.map(order => order.customerName)).toEqual(['Sample Guest', 'Sample Guest']);
});

for (const success of [true, false]) {
  test(`pending order locks checkout until ${success ? 'success' : 'failure'}`, async ({ page }) => {
    let releaseResponse!: () => void;
    const pending = new Promise<void>(resolve => { releaseResponse = resolve; });
    const orders: unknown[] = [];
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/api/public/orders' && request.method() === 'POST') {
        orders.push(request.postDataJSON());
        await pending;
        return success
          ? route.fulfill({ status: 201, json: { success: true, data: {
            orderRef: 'ORD-SAMPLE', total: '10.00', items: [{ name: 'Sample Tea', price: '10.00', quantity: 1 }],
          } } })
          : route.fulfill({ status: 400, json: { error: { message: 'Please try again.' } } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true, data: [] } });
      if (url.origin === 'http://127.0.0.1:3107') return route.continue();
      return route.abort();
    });
    try {
      await page.goto('/r/receipt-test/t/sample-table');
      await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
      await page.getByRole('button', { name: /Review & Place Order/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Review your order' });
      const name = dialog.getByLabel('Your name');
      const increase = dialog.getByRole('button', { name: 'Increase Sample Tea', exact: true });
      const decrease = dialog.getByRole('button', { name: 'Decrease Sample Tea', exact: true });
      const close = dialog.getByRole('button', { name: 'Close', exact: true });
      await name.fill('Sample Guest');
      await dialog.getByRole('button', { name: 'Place Order', exact: true }).click();
      await expect.poll(() => orders.length).toBe(1);
      await expect(dialog).toHaveAttribute('aria-busy', 'true');
      for (const control of [increase, decrease, close, name]) await expect(control).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Sending Order to Kitchen...' })).toBeDisabled();
      // Backdrop and keyboard dismissal must not expose an editable cart mid-request.
      await page.mouse.click(5, 5);
      await dialog.press('Escape');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Total Amount', { exact: true }).locator('../..')).toContainText('\u20b910');
      expect(orders).toEqual([{ tableToken: 'sample-table', customerName: 'Sample Guest', items: [{ itemId: '11111111-1111-4111-8111-111111111111', quantity: 1 }] }]);
      releaseResponse();
      if (success) {
        await expect(page.getByRole('dialog', { name: 'Order confirmation' })).toBeVisible();
        await page.getByRole('button', { name: 'Order More Dishes' }).click();
        await expect(page.getByRole('button', { name: /Review & Place Order/ })).toHaveCount(0);
      } else {
        await expect(dialog.getByRole('alert')).toContainText('Please try again.');
        await expect(dialog).toHaveAttribute('aria-busy', 'false');
        for (const control of [increase, decrease, close, name]) await expect(control).toBeEnabled();
        await expect(name).toHaveValue('Sample Guest');
        await increase.click();
        await expect(dialog.getByText('Total Amount', { exact: true }).locator('../..')).toContainText('\u20b920');
        await close.click();
        await expect(dialog).toHaveCount(0);
      }
      expect(orders).toHaveLength(1);
    } finally {
      releaseResponse();
    }
  });
}
