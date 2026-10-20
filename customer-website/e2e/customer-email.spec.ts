import { expect, test } from '@playwright/test';

test('lifecycle checkout waits for owner acceptance instead of claiming an email was sent', async ({page}) => {
  await page.route('**/api/public/orders',route=>route.fulfill({json:{success:true,data:{
    orderRef:'ORD-LIFECYCLE',total:'10.00',emailConfirmation:'on_acceptance',items:[],
  }}}));
  await page.goto('/r/customer-email/t/test-table');
  await page.getByRole('button',{name:'Add Sample Tea',exact:true}).click();
  await page.getByRole('button',{name:/Review & Place Order/}).click();
  await page.getByLabel('Email for order confirmation').fill('buyer@example.test');
  await page.getByRole('button',{name:'Place Order',exact:true}).click();
  await expect(page.getByText('Awaiting restaurant acceptance.',{exact:true})).toBeVisible();
  await expect(page.getByText('Order confirmation email requested.',{exact:true})).toHaveCount(0);
});

test('welcome and required email checkout work without customer login or OTP', async ({ page }) => {
  const posted: Record<string, unknown>[] = [];
  await page.route('**/api/public/orders', async route => {
    posted.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, data: { orderRef: 'ORD-EMAIL', total: '10.00', emailConfirmation: 'queued',
      items: [{ name: 'Sample Tea', quantity: 1, price: '10.00' }] } } });
  });
  await page.goto('/r/customer-email/t/test-table');
  await expect(page.getByRole('img', { name: 'Receipt Test Cafe owner', exact: true })).toBeVisible();
  await expect(page.getByText('Jaipur, Rajasthan', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Order food' }).click();
  await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
  await page.getByRole('button', { name: /Review & Place Order/ }).click();
  const review = page.getByRole('dialog', { name: 'Review your order' });
  await review.getByRole('button', { name: 'Place Order', exact: true }).click();
  expect(posted).toHaveLength(0);
  await review.getByLabel('Email for order confirmation').fill('buyer@example.test');
  await page.screenshot({ path: test.info().outputPath('customer-email-checkout.png'), fullPage: true });
  await review.getByRole('button', { name: 'Place Order', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Order confirmation' })).toBeVisible();
  expect(posted).toHaveLength(1);
  expect(posted[0].customerEmail).toBe('buyer@example.test');
  expect(posted[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(posted[0]).not.toHaveProperty('customerName');
  expect(posted[0]).not.toHaveProperty('customerPhone');
  await expect(page.getByText('Order confirmation email requested.', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/OTP|password|verification code/i)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('email and optional mobile survive retry with the same checkout request ID', async ({ page }) => {
  const posted: Record<string, unknown>[] = [];
  await page.route('**/api/public/orders', async route => {
    posted.push(route.request().postDataJSON());
    if (posted.length === 1) return route.fulfill({ status: 503, json: { success: false, error: { message: 'Temporary error' } } });
    await route.fulfill({ json: { success: true, data: { orderRef: 'ORD-RETRY', total: '10.00', emailConfirmation: 'queued', items: [] } } });
  });
  await page.goto('/r/customer-email/t/test-table');
  await page.getByRole('button', { name: 'Add Sample Tea', exact: true }).click();
  await page.getByRole('button', { name: /Review & Place Order/ }).click();
  const review = page.getByRole('dialog', { name: 'Review your order' });
  await review.getByLabel('Email for order confirmation').fill('buyer@example.test');
  await review.getByLabel('Mobile number').fill('123');
  await review.getByRole('button', { name: 'Place Order', exact: true }).click();
  expect(posted).toHaveLength(0);
  await review.getByLabel('Mobile number').fill('9999999999');
  await review.getByRole('button', { name: 'Place Order', exact: true }).click();
  await expect(review.getByRole('alert')).toHaveText('Temporary error');
  await expect(review.getByLabel('Email for order confirmation')).toHaveValue('buyer@example.test');
  await review.getByRole('button', { name: 'Place Order', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Order confirmation' })).toBeVisible();
  expect(posted[0].requestId).toBe(posted[1].requestId);
  expect(posted[0].customerPhone).toBe('9999999999');
});
