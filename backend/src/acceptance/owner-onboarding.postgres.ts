// Opt-in through scripts/run-auth-acceptance.cjs only. Real PostgreSQL, fake providers.
jest.mock('../services/emailService', () => ({ sendTransactionalEmail: jest.fn(async () => 'test-mail') }));
jest.mock('../services/googleIdentityService', () => ({ verifyGoogleIdentity: jest.fn() }));
jest.mock('../services/notificationService', () => ({
  ...jest.requireActual('../services/notificationService'), sendOrderNotification: jest.fn(async () => undefined),
}));
jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: {
  upload_stream: jest.fn(), destroy: jest.fn(async () => ({ result: 'ok' })),
} } }));

import { sendTransactionalEmail } from '../services/emailService';
import { verifyGoogleIdentity } from '../services/googleIdentityService';

const target = new URL(process.env.RESTROQR_ACCEPTANCE_DATABASE_URL || 'http://invalid');
if (target.hostname !== '127.0.0.1' || !/^\/restroqr_auth_acceptance_[a-z0-9_]+$/.test(target.pathname) ||
    process.env.DATABASE_URL !== process.env.RESTROQR_ACCEPTANCE_DATABASE_URL) {
  throw new Error('Refusing non-isolated acceptance database');
}

let pool: import('pg').Pool;
let signup: typeof import('../services/ownerSignupService');
let google: typeof import('../services/ownerGoogleAuthService');

function lastCode(): string {
  const calls = (sendTransactionalEmail as jest.Mock).mock.calls;
  const text = calls[calls.length - 1][0].text as string;
  const code = text.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error('Missing test OTP');
  return code;
}
const input = { email: 'owner@example.test', password: 'test-password-only', name: 'Test Owner' };

beforeAll(() => {
  pool = require('../config/database').default;
  signup = require('../services/ownerSignupService');
  google = require('../services/ownerGoogleAuthService');
});
beforeEach(async () => {
  // The runner and guard above require a dedicated disposable database.
  await pool.query('TRUNCATE owner_signup_challenges, owners RESTART IDENTITY CASCADE');
  jest.clearAllMocks();
  (sendTransactionalEmail as jest.Mock).mockResolvedValue('test-mail');
});
afterAll(async () => { if (pool) await pool.end(); });

it('runs signup -> OTP -> matching Google link -> Google login against PostgreSQL', async () => {
  const pending = await signup.startOwnerSignup(input);
  expect((await pool.query('SELECT id FROM owners')).rowCount).toBe(0);
  const owner = await signup.verifyOwnerSignup(pending.challengeId, lastCode());
  expect((await pool.query('SELECT requires_google_link FROM owners')).rows[0].requires_google_link).toBe(true);
  (verifyGoogleIdentity as jest.Mock).mockResolvedValue({ uid: 'firebase-1', subject: 'google-1', email: input.email });
  await google.linkOwnerGoogle(owner.owner.id, 'fake-proof');
  expect((await pool.query('SELECT requires_google_link FROM owners')).rows[0].requires_google_link).toBe(false);
  await expect(google.loginOwnerGoogle('fake-proof')).resolves.toMatchObject({ user: { id: owner.owner.id, role: 'owner' } });
});

it('allows exactly one concurrent OTP verification to create an owner', async () => {
  const pending = await signup.startOwnerSignup(input);
  const code = lastCode();
  const attempts = await Promise.allSettled([
    signup.verifyOwnerSignup(pending.challengeId, code), signup.verifyOwnerSignup(pending.challengeId, code),
  ]);
  expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await pool.query('SELECT id FROM owners')).rowCount).toBe(1);
});

it('persists five concurrent invalid guesses and rejects a subsequent correct OTP', async () => {
  const pending = await signup.startOwnerSignup(input);
  const correct = lastCode();
  const wrong = correct === '000000' ? '000001' : '000000';
  await Promise.allSettled(Array.from({ length: 5 }, () => signup.verifyOwnerSignup(pending.challengeId, wrong)));
  expect((await pool.query('SELECT attempts FROM owner_signup_challenges')).rows[0].attempts).toBe(5);
  await expect(signup.verifyOwnerSignup(pending.challengeId, correct)).rejects.toMatchObject({ statusCode: 401 });
});

it('serializes concurrent resend requests without resetting attempts', async () => {
  const pending = await signup.startOwnerSignup(input);
  await pool.query("UPDATE owner_signup_challenges SET sent_at=NOW()-INTERVAL '2 minutes', attempts=2");
  const results = await Promise.allSettled([
    signup.resendOwnerSignup(pending.challengeId), signup.resendOwnerSignup(pending.challengeId),
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await pool.query('SELECT attempts,send_count FROM owner_signup_challenges')).rows[0]).toEqual({ attempts: 2, send_count: 2 });
});

it('rolls back a failed provider send without creating a challenge or owner', async () => {
  (sendTransactionalEmail as jest.Mock).mockRejectedValue(new Error('fake-provider-failure'));
  await expect(signup.startOwnerSignup(input)).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
  expect((await pool.query('SELECT id FROM owner_signup_challenges')).rowCount).toBe(0);
  expect((await pool.query('SELECT id FROM owners')).rowCount).toBe(0);
});

it('rejects expired OTPs', async () => {
  const pending = await signup.startOwnerSignup(input);
  const code = lastCode();
  await pool.query("UPDATE owner_signup_challenges SET expires_at=NOW()-INTERVAL '1 minute'");
  await expect(signup.verifyOwnerSignup(pending.challengeId, code)).rejects.toMatchObject({ statusCode: 401 });
});

it('supports password login with differently cased email after OTP signup', async () => {
  const pending = await signup.startOwnerSignup(input);
  await signup.verifyOwnerSignup(pending.challengeId, lastCode());
  const { login } = require('../services/authService');
  await expect(login({ email: ' Owner@Example.Test ', password: input.password }))
    .resolves.toMatchObject({ user: { role: 'owner' } });
});

it('refuses mismatched Google email without saving a link', async () => {
  const pending = await signup.startOwnerSignup(input);
  const owner = await signup.verifyOwnerSignup(pending.challengeId, lastCode());
  (verifyGoogleIdentity as jest.Mock).mockResolvedValue({ uid: 'firebase-1', subject: 'google-1', email: 'someone@example.test' });
  await expect(google.linkOwnerGoogle(owner.owner.id, 'fake-proof')).rejects.toMatchObject({ statusCode: 409 });
  expect((await pool.query('SELECT firebase_uid,requires_google_link FROM owners')).rows[0])
    .toEqual({ firebase_uid: null, requires_google_link: true });
});

it('does not allow a disabled owner to log in through linked Google', async () => {
  const pending = await signup.startOwnerSignup(input);
  const owner = await signup.verifyOwnerSignup(pending.challengeId, lastCode());
  (verifyGoogleIdentity as jest.Mock).mockResolvedValue({ uid: 'firebase-1', subject: 'google-1', email: input.email });
  await google.linkOwnerGoogle(owner.owner.id, 'fake-proof');
  await pool.query("UPDATE owners SET status='disabled'");
  await expect(google.loginOwnerGoogle('fake-proof')).rejects.toMatchObject({ statusCode: 403 });
});

async function restaurantFixture() {
  const pending = await signup.startOwnerSignup(input);
  const owner = await signup.verifyOwnerSignup(pending.challengeId, lastCode());
  (verifyGoogleIdentity as jest.Mock).mockResolvedValue({ uid: 'firebase-1', subject: 'google-1', email: input.email });
  await google.linkOwnerGoogle(owner.owner.id, 'fake-proof');
  const { createRestaurant } = require('../services/ownerRestaurantService');
  const restaurant = await createRestaurant({ ownerId: owner.owner.id, name: 'Test Cafe', address: 'Jaipur', phone: '9999999999' });
  return { owner: owner.owner, restaurant };
}

it('marks newly created restaurants for profile completion without activating early', async () => {
  const { owner } = await restaurantFixture();
  const { getOwnerProfileSetup } = require('../services/restaurantProfileService');
  const setup = await getOwnerProfileSetup(owner.id);
  expect(setup).toMatchObject({ onboardingRequired: true, complete: false, orderingEnabled: false });
  expect(setup.missing).toEqual(expect.arrayContaining(['ownerPhoto','restaurantCover','businessUpi']));
});

it('enforces activation on real order creation and preserves existing orders', async () => {
  const { owner, restaurant } = await restaurantFixture();
  const { createTable } = require('../services/tableService');
  const { createOrder } = require('../services/orderService');
  const { setBusinessUpi, getOwnerProfileSetup } = require('../services/restaurantProfileService');
  await pool.query("UPDATE restaurants SET qr_mode='multi' WHERE id=$1", [restaurant.id]);
  const table = await createTable(restaurant.id, 'Table 1');
  const category = (await pool.query("INSERT INTO categories (restaurant_id,name) VALUES ($1,'Food') RETURNING id", [restaurant.id])).rows[0];
  const item = (await pool.query("INSERT INTO food_items (category_id,restaurant_id,name,price,badge) VALUES ($1,$2,'Meal',100,'veg') RETURNING id",
    [category.id, restaurant.id])).rows[0];
  await expect(createOrder(table.tableToken, [{ itemId: item.id, quantity: 1 }])).rejects.toMatchObject({ statusCode: 409 });
  // Synthetic trusted storage fixtures; this does not test real Cloudinary upload.
  await pool.query("UPDATE owners SET profile_image_url='https://images.test/owner.jpg' WHERE id=$1", [owner.id]);
  await pool.query("UPDATE restaurants SET cover_image_url='https://images.test/cover.jpg' WHERE id=$1", [restaurant.id]);
  await setBusinessUpi(owner.id, 'cafe@bank');
  expect(await getOwnerProfileSetup(owner.id)).toMatchObject({ complete: true, orderingEnabled: true, completionPercent: 100 });
  await expect(createOrder(table.tableToken, [{ itemId: item.id, quantity: 1 }])).resolves.toMatchObject({ status: 'pending', total: '100.00' });
  await pool.query('UPDATE restaurants SET cover_image_url=NULL WHERE id=$1', [restaurant.id]);
  await expect(createOrder(table.tableToken, [{ itemId: item.id, quantity: 1 }])).rejects.toMatchObject({ statusCode: 409 });
  expect((await pool.query('SELECT id FROM orders')).rowCount).toBe(1);
});

it('does not change another owner payment details', async () => {
  const { owner, restaurant } = await restaurantFixture();
  const { setBusinessUpi } = require('../services/restaurantProfileService');
  await setBusinessUpi(owner.id, 'cafe@bank');
  await expect(setBusinessUpi('00000000-0000-4000-8000-000000000000', 'attacker@bank')).rejects.toMatchObject({ statusCode: 404 });
  expect((await pool.query('SELECT business_upi_id FROM restaurants WHERE id=$1', [restaurant.id])).rows[0].business_upi_id).toBe('cafe@bank');
});

it('keeps legacy restaurants working while new profile rollout is enabled', async () => {
  const { restaurant } = await restaurantFixture();
  await pool.query('UPDATE restaurants SET onboarding_required=false WHERE id=$1', [restaurant.id]);
  const { getRestaurantOrderingState } = require('../services/restaurantProfileService');
  expect(await getRestaurantOrderingState(restaurant.id)).toMatchObject({ orderingEnabled: true, complete: false });
});

it('round-trips dish emoji through owner HTTP editing and the public menu', async () => {
  const { owner, restaurant } = await restaurantFixture();
  const category = (await pool.query("INSERT INTO categories (restaurant_id,name) VALUES ($1,'Food') RETURNING id", [restaurant.id])).rows[0];
  const { createFoodItem } = require('../services/foodItemService');
  const item = await createFoodItem(restaurant.id, category.id, { name: 'Pizza', price: 120, badge: 'veg' });
  const app = require('../index').default;
  const request = require('supertest');
  const { signToken } = require('../utils/token');
  const endpoint = `/api/owner/items/${item.id}/media`;
  expect((await request(app).put(endpoint).send({ emoji: '\u{1F355}' })).status).toBe(401);
  const auth = `Bearer ${signToken(owner.id, 'owner')}`;
  expect((await request(app).put(endpoint).set('Authorization', auth).send({ emoji: '\u{1F355}' })).status).toBe(200);
  const { getPublicMenu } = require('../services/publicMenuService');
  expect((await getPublicMenu(restaurant.restaurantToken)).categories[0].items[0])
    .toMatchObject({ emoji: '\u{1F355}', imageUrl: null, price: '120.00' });
  const { listFoodItems } = require('../services/foodItemService');
  expect((await listFoodItems(category.id, restaurant.id))[0].emoji).toBe('\u{1F355}');
  expect((await request(app).put(endpoint).set('Authorization', auth).send({ emoji: 'pizza' })).status).toBe(400);
  expect((await request(app).put(endpoint).set('Authorization', auth).send({ emoji: null })).status).toBe(200);
  expect((await listFoodItems(category.id, restaurant.id))[0].emoji).toBeNull();
});

it('blocks cross-restaurant media changes in real SQL', async () => {
  const { restaurant } = await restaurantFixture();
  const category = (await pool.query("INSERT INTO categories (restaurant_id,name) VALUES ($1,'Food') RETURNING id", [restaurant.id])).rows[0];
  const { createFoodItem } = require('../services/foodItemService');
  const item = await createFoodItem(restaurant.id, category.id, { name: 'Pizza', price: 120, badge: 'veg' });
  const { setMenuEmoji } = require('../services/menuMediaService');
  await expect(setMenuEmoji(item.id, '00000000-0000-4000-8000-000000000000', '\u{1F355}'))
    .rejects.toMatchObject({ statusCode: 404 });
  expect((await pool.query('SELECT emoji FROM food_items WHERE id=$1', [item.id])).rows[0].emoji).toBeNull();
});

it('multipart dish upload persists the provider URL and clears its previous emoji', async () => {
  const { owner, restaurant } = await restaurantFixture();
  const category = (await pool.query("INSERT INTO categories (restaurant_id,name) VALUES ($1,'Food') RETURNING id", [restaurant.id])).rows[0];
  const { createFoodItem, listFoodItems } = require('../services/foodItemService');
  const item = await createFoodItem(restaurant.id, category.id, { name: 'Pizza', price: 120, badge: 'veg' });
  const { setMenuEmoji } = require('../services/menuMediaService');
  await setMenuEmoji(item.id, restaurant.id, '\u{1F355}');
  const { v2: cloudinary } = require('cloudinary');
  cloudinary.uploader.upload_stream.mockImplementation((_options: unknown, callback: Function) => ({
    end: () => callback(null, { secure_url: 'https://res.cloudinary.com/test/dish.jpg', public_id: 'test-dish' }),
  }));
  const prior = process.env.CLOUDINARY_URL;
  process.env.CLOUDINARY_URL = 'cloudinary://fake:key@test';
  try {
    const request = require('supertest');
    const app = require('../index').default;
    const { signToken } = require('../utils/token');
    const auth = `Bearer ${signToken(owner.id, 'owner')}`;
    const endpoint = `/api/owner/items/${item.id}/image`;
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    expect((await request(app).post(endpoint).set('Authorization', auth).attach('image', png, 'dish.png')).status).toBe(200);
    expect((await listFoodItems(category.id, restaurant.id))[0]).toMatchObject({ imageUrl: 'https://res.cloudinary.com/test/dish.jpg', emoji: null });
    expect((await request(app).post(endpoint).set('Authorization', auth).attach('image', Buffer.from('bad'), 'fake.png')).status).toBe(400);
  } finally {
    if (prior === undefined) delete process.env.CLOUDINARY_URL; else process.env.CLOUDINARY_URL = prior;
  }
});

async function configuredDishFixture() {
  const { owner, restaurant } = await restaurantFixture();
  await pool.query("UPDATE restaurants SET qr_mode='multi',onboarding_required=false WHERE id=$1", [restaurant.id]);
  const category = (await pool.query("INSERT INTO categories (restaurant_id,name) VALUES ($1,'Food') RETURNING id", [restaurant.id])).rows[0];
  const { createFoodItem } = require('../services/foodItemService');
  const item = await createFoodItem(restaurant.id, category.id, { name: 'Pizza', price: 90, badge: 'veg' });
  const { createTable } = require('../services/tableService');
  const table = await createTable(restaurant.id, 'Options Table');
  const { saveMenuOptions } = require('../services/menuOptionsService');
  const saved = await saveMenuOptions(item.id, restaurant.id, {
    variants: [{ name: 'Small', price: '100.10' }, { name: 'Large', price: '180.20' }],
    addOns: [{ name: 'Cheese', price: '20.30' }],
  });
  return { owner, restaurant, category, item, table, options: saved.options };
}

it('prices multiple combinations server-side and preserves order snapshots after dish deletion', async () => {
  const { restaurant, item, table, options } = await configuredDishFixture();
  const { createOrder, getOrders } = require('../services/orderService');
  const order = await createOrder(table.tableToken, [
    { itemId: item.id, quantity: 2, variantId: options.variants[1].id, addOnIds: [options.addOns[0].id], price: 0.01 },
    { itemId: item.id, quantity: 1, variantId: options.variants[0].id },
  ]);
  expect(order.total).toBe('501.10');
  expect(order.items[0]).toMatchObject({ itemPrice: '200.50', quantity: 2, optionSummary: 'Large, + Cheese' });
  expect(order.items[1]).toMatchObject({ itemPrice: '100.10', optionSummary: 'Small' });
  await pool.query('DELETE FROM food_items WHERE id=$1', [item.id]);
  const history = await getOrders(restaurant.id);
  expect(history.orders[0].items[0]).toMatchObject({ foodItemId: null, itemPrice: '200.50', optionSummary: 'Large, + Cheese' });
});

it('rejects missing, foreign and newly disabled option selections without creating orders', async () => {
  const { restaurant, item, table, options } = await configuredDishFixture();
  const { createOrder } = require('../services/orderService');
  await expect(createOrder(table.tableToken, [{ itemId: item.id, quantity: 1 }])).rejects.toMatchObject({ statusCode: 409 });
  await expect(createOrder(table.tableToken, [{ itemId: item.id, quantity: 1, variantId: options.addOns[0].id }])).rejects.toMatchObject({ statusCode: 409 });
  const { saveMenuOptions } = require('../services/menuOptionsService');
  options.addOns[0].isAvailable = false;
  await saveMenuOptions(item.id, restaurant.id, options);
  await expect(createOrder(table.tableToken, [{ itemId: item.id, quantity: 1, variantId: options.variants[0].id,
    addOnIds: [options.addOns[0].id] }])).rejects.toMatchObject({ statusCode: 409 });
  expect((await pool.query('SELECT id FROM orders')).rowCount).toBe(0);
});

it('supports removing all options while rejecting old stale selections', async () => {
  const { restaurant, item, table, options } = await configuredDishFixture();
  const { saveMenuOptions } = require('../services/menuOptionsService');
  await expect(saveMenuOptions(item.id, '00000000-0000-4000-8000-000000000000', { variants: [], addOns: [] })).rejects.toMatchObject({ statusCode: 404 });
  await saveMenuOptions(item.id, restaurant.id, { variants: [], addOns: [] });
  const { createOrder } = require('../services/orderService');
  await expect(createOrder(table.tableToken, [{ itemId: item.id, quantity: 1, variantId: options.variants[0].id }])).rejects.toMatchObject({ statusCode: 409 });
  expect((await createOrder(table.tableToken, [{ itemId: item.id, quantity: 1 }])).total).toBe('90.00');
});

it('serializes option edits with the order catalog read lock', async () => {
  const { restaurant, item, table, options } = await configuredDishFixture();
  const { createOrder } = require('../services/orderService');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    options.variants[0].price = '125.00';
    await client.query('UPDATE food_items SET menu_options=$1::jsonb WHERE id=$2', [JSON.stringify(options), item.id]);
    const placing = createOrder(table.tableToken, [{ itemId: item.id, quantity: 1, variantId: options.variants[0].id }]);
    let blocked = false;
    for (let i = 0; i < 40; i++) {
      const activity = await pool.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
        AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%ORDER BY id FOR SHARE%'`);
      if (activity.rows.length) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    expect(blocked).toBe(true);
    // Release the update only after checkout is demonstrably waiting for the row.
    await client.query('COMMIT');
    expect((await placing).total).toBe('125.00');
    const { getPublicMenu } = require('../services/publicMenuService');
    const menu = await getPublicMenu(restaurant.restaurantToken);
    expect(menu.categories[0].items[0].options.variants[0].price).toBe('125.00');
  } finally { await client.query('ROLLBACK'); client.release(); }
});

it('accepts fifty valid configured lines larger than 10KB through the HTTP endpoint', async () => {
  const { restaurant, item, table, options } = await configuredDishFixture();
  const { saveMenuOptions } = require('../services/menuOptionsService');
  const configured = await saveMenuOptions(item.id, restaurant.id, { variants: options.variants,
    addOns: Array.from({ length: 20 }, (_, index) => ({ name: `Extra ${index}`, price: 0 })),
  });
  const items = [];
  for (let first = 0; first < 20 && items.length < 50; first++) {
    for (let second = first + 1; second < 20 && items.length < 50; second++) {
      items.push({ itemId: item.id, quantity: 1, variantId: options.variants[0].id,
        addOnIds: configured.options.addOns.filter((_: unknown, index: number) => index !== first && index !== second)
          .map((addon: { id: string }) => addon.id) });
    }
  }
  const payload = { tableToken: table.tableToken, items };
  expect(Buffer.byteLength(JSON.stringify(payload))).toBeGreaterThan(10 * 1024);
  const request = require('supertest');
  const app = require('../index').default;
  const result = await request(app).post('/api/public/orders').send(payload);
  expect(result.status).toBe(201);
  expect(result.body.data.total).toBe('5005.00');
  expect(result.body.data.items).toHaveLength(50);
  const oversized = await request(app).post('/api/public/orders').send({ ...payload, extra: 'x'.repeat(65 * 1024) });
  expect(oversized.status).toBe(413);
  expect((await pool.query('SELECT id FROM orders')).rowCount).toBe(1);
});
