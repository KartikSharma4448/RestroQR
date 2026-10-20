import { expect, test } from '@playwright/test';

test('different sizes remain separate and order payload sends IDs rather than prices', async ({ page }) => {
  let posted: { items: { itemId: string; quantity: number; variantId?: string; addOnIds?: string[]; price?: number }[] } | undefined;
  await page.route('**/api/public/orders', async route => {
    posted = route.request().postDataJSON();
    await route.fulfill({ json: { success: true, data: { orderRef: 'ORD-OPTIONS', total: '400.00', items: [
      { name: 'Pizza', quantity: 1, price: '200.00', optionSummary: 'Large, + Cheese' },
      { name: 'Pizza', quantity: 2, price: '100.00', optionSummary: 'Small' },
    ] } } });
  });
  await page.goto('/r/options-menu/t/test-table');
  await page.getByRole('button', { name: 'Customize Pizza', exact: true }).click();
  const custom = page.getByRole('dialog', { name: 'Customize Pizza', exact: true });
  await custom.getByRole('radio', { name: /Large/ }).check();
  await custom.getByRole('checkbox', { name: /Cheese/ }).check();
  await page.screenshot({ path: test.info().outputPath('options-picker.png'), fullPage: true });
  await custom.getByRole('button', { name: /Add to selection - INR 200/ }).click();
  await page.getByRole('button', { name: 'Customize Pizza', exact: true }).click();
  await custom.getByRole('button', { name: /Add to selection - INR 100/ }).click();
  await page.getByRole('button', { name: /Review & Place Order/ }).click();
  const review = page.getByRole('dialog', { name: 'Review your order' });
  await expect(review.getByText('Large, + Cheese', { exact: true })).toBeVisible();
  const smallLine = review.locator('.cart-item').filter({ has: page.getByText('Small', { exact: true }) });
  await smallLine.getByRole('button', { name: 'Increase Pizza', exact: true }).click();
  await expect(review.getByText('\u20b9400', { exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Place Order', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Order confirmation' })).toBeVisible();
  expect(posted?.items).toEqual([
    { itemId: '11111111-1111-4111-8111-111111111111', quantity: 1, variantId: '33333333-3333-4333-8333-333333333333', addOnIds: ['44444444-4444-4444-8444-444444444444'] },
    { itemId: '11111111-1111-4111-8111-111111111111', quantity: 2, variantId: '22222222-2222-4222-8222-222222222222' },
  ]);
  await expect(page.getByText('Large, + Cheese', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('options-order.png'), fullPage: true });
});

test('unavailable options cannot be selected and Escape cancels without adding', async ({ page }) => {
  await page.goto('/r/options-menu');
  await page.getByRole('button', { name: 'Customize Pizza', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Customize Pizza' });
  await expect(dialog.getByRole('radio', { name: /Sold size/ })).toBeDisabled();
  await expect(dialog.getByRole('checkbox', { name: /Sold add-on/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /View Selection/ })).toHaveCount(0);
});

test('identical combinations merge regardless of add-on click order', async ({ page }) => {
  await page.goto('/r/options-menu');
  for (const choices of [['Cheese', 'Sauce'], ['Sauce', 'Cheese']]) {
    await page.getByRole('button', { name: 'Customize Pizza', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Customize Pizza' });
    for (const name of choices) await dialog.getByRole('checkbox', { name: new RegExp(name) }).check();
    await dialog.getByRole('button', { name: /Add to selection/ }).click();
  }
  await page.getByRole('button', { name: /View Selection/ }).click();
  await expect(page.locator('.cart-item')).toHaveCount(1);
  await expect(page.locator('.cart-item').getByText('2', { exact: true })).toBeVisible();
});
