import { test, expect } from '@playwright/test';

const token = (role: string, exp = 4102444800) =>
  `header.${Buffer.from(JSON.stringify({ sub: 'sample', role, exp })).toString('base64url')}.signature`;

const owners = ['Alpha', 'Beta'].map((name, index) => ({
  id: String(index + 1), name, email: `${name.toLowerCase()}@example.test`,
  phone: null, status: 'active', createdAt: '2026-10-01T10:00:00Z', restaurant: null,
}));

for (const width of [390, 1280]) {
  test(`A15 delete modal traps focus and restores it at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    let deletes = 0;
    await page.addInitScript(value => localStorage.setItem('restroqr_admin_token', value), token('admin'));
    await page.route('**/*', route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.includes('/api/')) {
        if (req.method() === 'DELETE') deletes++;
        return route.fulfill({ json: { success: true, data: {
          restaurants: [{ id: 'sample', name: 'Sample Cafe', ownerName: 'Alpha', status: 'active' }],
          pagination: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
        } } });
      }
      if (url.origin === 'http://127.0.0.1:5178') return route.continue();
      return route.abort();
    });
    await page.goto('/restaurants');
    const trigger = page.getByRole('button', { name: 'Delete', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Delete Restaurant' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
    await page.getByRole('link', { name: 'Back to Dashboard' }).evaluate((node: HTMLElement) => node.focus());
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
    await expect(dialog).toHaveScreenshot(`delete-dialog-${width}.png`, { maxDiffPixelRatio: 0.01 });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(deletes).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const suffix of ['', '/t/sample-table']) {
  test(`A14 Try Again restores original QR ${suffix || 'menu'} after recovery`, async ({ page, request }) => {
    await request.post('http://127.0.0.1:4319/__audit/retry?available=false');
    await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:3107'
      ? route.continue() : route.abort());
    const original = `/r/retry-test${suffix}`;
    await page.goto(`http://127.0.0.1:3107${original}`);
    await expect(page.getByRole('heading', { name: 'Menu Unavailable' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('retry')).toBe(original);
    await request.post('http://127.0.0.1:4319/__audit/retry?available=true');
    await page.getByRole('button', { name: 'Try Again' }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:3107${original}`);
    await expect(page.getByRole('heading', { name: 'Receipt Test Cafe', exact: true })).toBeVisible();
  });
}

for (const unsafe of ['https://example.test', '//example.test', 'javascript:alert(1)', '/error']) {
  test(`A14 rejects unsafe retry target ${unsafe}`, async ({ page }) => {
    await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:3107'
      ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:3107/error?retry=${encodeURIComponent(unsafe)}`);
    await page.getByRole('button', { name: 'Try Again' }).click();
    await expect(page).toHaveURL('http://127.0.0.1:3107/');
  });
}

for (const failure of [false, true]) {
  test(`A13 latest owner survives stale ${failure ? 'failure' : 'success'}`, async ({ page }) => {
    let release!: () => void;
    const first = new Promise<void>(resolve => { release = resolve; });
    await page.addInitScript(value => localStorage.setItem('restroqr_admin_token', value), token('admin'));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/admin/owners')) return route.fulfill({ json: { success: true, data: { owners } } });
      if (url.pathname.endsWith('/admin/owners/1')) {
        await first;
        return route.fulfill({ status: failure ? 500 : 200, json: { success: !failure, data: { owner: owners[0] } } });
      }
      if (url.pathname.endsWith('/admin/owners/2')) return route.fulfill({ json: { success: true, data: { owner: owners[1] } } });
      if (url.origin === 'http://127.0.0.1:5178') return route.continue();
      return route.abort();
    });
    try {
      await page.goto('/owners');
      await page.getByRole('row').filter({ hasText: 'alpha@example.test' }).getByRole('button', { name: 'View', exact: true }).click();
      await page.getByRole('row').filter({ hasText: 'beta@example.test' }).getByRole('button', { name: 'View', exact: true }).click();
      const panel = page.getByRole('heading', { name: 'Owner Details' }).locator('..');
      await expect(panel.getByText('Beta', { exact: true })).toBeVisible();
      const response = page.waitForResponse(url => url.url().endsWith('/admin/owners/1'));
      release();
      await (await response).finished();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(panel.getByText('Beta', { exact: true })).toBeVisible();
      await expect(panel.getByText('Alpha', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
    } finally { release(); }
  });
}

for (const role of ['owner', 'admin']) {
  test(`A12 admin login ${role === 'admin' ? 'accepts admin' : 'rejects owner'} role`, async ({ page }) => {
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/auth/login')) return route.fulfill({ json: {
        success: true, data: { token: token(role), user: { id: 'sample', role, name: 'Sample' } },
      } });
      if (url.origin === 'http://127.0.0.1:5178') return route.continue();
      return route.abort();
    });
    await page.goto('/login');
    await page.getByLabel('Email address').fill('sample@example.test');
    await page.getByLabel('Password', { exact: true }).fill('SamplePassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    if (role === 'admin') {
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('alert')).toContainText('administrator account is required');
      await expect(page).toHaveURL(/\/login$/);
      expect(await page.evaluate(() => localStorage.getItem('restroqr_admin_token'))).toBeNull();
    }
  });
}

for (const [index, invalid] of [token('owner'), token('admin', 1), 'malformed'].entries()) {
  test(`A12 stored invalid session redirects to login (case ${index})`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('restroqr_admin_token', value), invalid);
    await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:5178'
      ? route.continue() : route.abort());
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('restroqr_admin_token'))).toBeNull();
  });
}
