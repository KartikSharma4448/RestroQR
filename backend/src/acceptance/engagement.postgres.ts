import { randomUUID, createHash } from 'crypto';
const url = new URL(process.env.RESTROQR_ACCEPTANCE_DATABASE_URL || 'http://invalid');
if (
  url.hostname !== '127.0.0.1' ||
  !/^\/restroqr_auth_acceptance_[a-z0-9_]+$/.test(url.pathname) ||
  process.env.DATABASE_URL !== process.env.RESTROQR_ACCEPTANCE_DATABASE_URL
)
  throw Error('Unsafe database');
const pool: import('pg').Pool = require('../config/database').default;
const service: typeof import('../services/customerEngagementService') = require('../services/customerEngagementService');
const orders: typeof import('../services/orderService') = require('../services/orderService');
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
beforeEach(async () => {
  process.env.CUSTOMER_EMAIL_ORDERING_ENABLED = 'true';
  process.env.PAYMENT_RECEIPT_EMAIL_ENABLED = 'true';
  process.env.ORDER_LIFECYCLE_EMAIL_ENABLED = 'true';
  process.env.LOYALTY_ENABLED = 'true';
  process.env.CUSTOMER_REVIEWS_ENABLED = 'true';
  process.env.ORDER_EMAIL_DELIVERY_ENABLED = 'false';
  await pool.query('TRUNCATE owners RESTART IDENTITY CASCADE');
});
afterAll(async () => {
  await pool.end();
});
const settings = {
  enabled: true,
  scheme: 'both',
  visitReward: 'Tea',
  spendReward: 'Dip',
  thresholdCents: 30000,
  expiryDays: 30,
  timezone: 'Asia/Kolkata',
};
async function fixture() {
  const owner = (
    await pool.query(
      "INSERT INTO owners(name,email,password_hash) VALUES('Owner','owner@example.test','no-login') RETURNING id",
    )
  ).rows[0];
  const r = await require('../services/ownerRestaurantService').createRestaurant({
    ownerId: owner.id,
    name: 'Test Cafe',
    address: 'Jaipur',
    phone: '9999999999',
  });
  await pool.query("UPDATE restaurants SET qr_mode='multi',onboarding_required=false WHERE id=$1", [
    r.id,
  ]);
  const table = await require('../services/tableService').createTable(r.id, 'A');
  await service.saveLoyaltySettings(r.id, settings);
  return { r, table };
}
async function paid(f: Awaited<ReturnType<typeof fixture>>, day: string, total = '100.00') {
  const row = (
    await pool.query(
      `INSERT INTO orders(restaurant_id,table_id,order_ref,status,total,customer_email,payment_received_at)
    VALUES($1,$2,$3,'payment_received',$4,'buyer@example.test',$5) RETURNING *`,
      [f.r.id, f.table.id, `ORD-${randomUUID().slice(0, 6)}`, total, `${day}T12:00:00Z`],
    )
  ).rows[0];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const links = await service.recordPaidEngagement(client, row);
    await client.query('COMMIT');
    return { row, links };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
function rewardLink(links: string[]) {
  const link = links.find((x) => x.includes('/reward#'))!;
  return link.split('#')[1].split('.');
}
it('counts seven nonconsecutive paid dates, not orders; cycles restart only after redemption', async () => {
  const f = await fixture();
  for (let i = 1; i <= 6; i++) {
    await paid(f, `2026-09-${String(i * 2).padStart(2, '0')}`);
  }
  await paid(f, '2026-09-12');
  expect((await pool.query("SELECT 1 FROM loyalty_rewards WHERE kind='visits'")).rowCount).toBe(0);
  const seventh = await paid(f, '2026-09-20');
  const [token, claim] = rewardLink(seventh.links);
  expect(await service.getReward(token, claim)).toMatchObject({
    reward: 'Tea',
    status: 'available',
  });
  const outcomes = await Promise.all([
    service.redeemReward(f.r.id, claim),
    service.redeemReward(f.r.id, claim),
  ]);
  expect(outcomes.filter((x) => !x.replayed)).toHaveLength(1);
  expect(await service.getReward(token, claim)).toMatchObject({ status: 'redeemed' });
  // All historical dates and the redemption date cannot qualify for the next cycle.
  await paid(f, '2026-09-21');
  expect((await pool.query("SELECT 1 FROM loyalty_rewards WHERE kind='visits'")).rowCount).toBe(1);
});
it('combines daily paid spend and issues at most one daily reward', async () => {
  const f = await fixture();
  await paid(f, '2026-09-01', '200');
  const second = await paid(f, '2026-09-01', '100');
  expect(rewardLink(second.links)).toHaveLength(2);
  await paid(f, '2026-09-01', '300');
  expect((await pool.query("SELECT 1 FROM loyalty_rewards WHERE kind='spend'")).rowCount).toBe(1);
  await paid(f, '2026-09-02', '300');
  expect((await pool.query("SELECT 1 FROM loyalty_rewards WHERE kind='spend'")).rowCount).toBe(2);
});
it('records local restaurant dates at the timezone boundary', async () => {
  const f = await fixture();
  const p = await paid(f, '2026-09-01');
  await pool.query('DELETE FROM loyalty_payments WHERE order_id=$1', [p.row.id]);
  await pool.query("UPDATE orders SET payment_received_at='2026-09-01 20:00:00' WHERE id=$1", [
    p.row.id,
  ]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await service.recordPaidEngagement(client, p.row);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  expect(
    (await pool.query("SELECT to_char(paid_day,'YYYY-MM-DD') AS day FROM loyalty_payments")).rows[0]
      .day,
  ).toBe('2026-09-02');
});
it('links rewards/review only in the transactional receipt and repeated Paid does not duplicate', async () => {
  const f = await fixture();
  const row = (
    await pool.query(
      `INSERT INTO orders(restaurant_id,table_id,order_ref,status,total,customer_email)
    VALUES($1,$2,'ORD-ABC123','completed',300,'buyer@example.test') RETURNING *`,
      [f.r.id, f.table.id],
    )
  ).rows[0];
  await Promise.all([
    orders.updateOrderStatus(row.id, f.r.id, 'payment_received'),
    orders.updateOrderStatus(row.id, f.r.id, 'payment_received'),
  ]);
  expect((await pool.query('SELECT 1 FROM loyalty_payments')).rowCount).toBe(1);
  const mail = (
    await pool.query("SELECT body FROM order_email_outbox WHERE kind='payment-receipt'")
  ).rows;
  expect(mail).toHaveLength(1);
  expect(mail[0].body).toContain('/reward#');
  expect(mail[0].body).toContain('/visit#');
});
it('does not accrue while owner disables the scheme or when feature flags are off', async () => {
  const f = await fixture();
  await service.saveLoyaltySettings(f.r.id, { ...settings, enabled: false });
  await paid(f, '2026-09-01', '300');
  expect((await pool.query('SELECT 1 FROM loyalty_payments')).rowCount).toBe(0);
  process.env.LOYALTY_ENABLED = 'false';
  await expect(service.getLoyaltySettings(f.r.id)).rejects.toMatchObject({ statusCode: 404 });
});
it('rejects cross-restaurant claims, bad secrets and expired rewards', async () => {
  const f = await fixture();
  const [token, claim] = rewardLink((await paid(f, '2026-09-01', '300')).links);
  await expect(service.getReward(token, '0'.repeat(64))).rejects.toMatchObject({ statusCode: 404 });
  await expect(service.redeemReward(randomUUID(), claim)).rejects.toMatchObject({
    statusCode: 404,
  });
  await pool.query("UPDATE loyalty_rewards SET expires_at=NOW()-INTERVAL '1 second'");
  await expect(service.redeemReward(f.r.id, claim)).rejects.toMatchObject({ statusCode: 409 });
  expect(await service.getReward(token, claim)).toMatchObject({ status: 'expired' });
  expect((await service.ownerEngagement(f.r.id)).rewards[0]).not.toHaveProperty('token_hash');
});
it('refund accounting is idempotent, bounded and revokes unredeemed daily rewards', async () => {
  const f = await fixture(),
    p = await paid(f, '2026-09-01', '300');
  const [token, claim] = rewardLink(p.links),
    requestId = randomUUID();
  await service.recordLoyaltyRefund(f.r.id, p.row.id, 10000, requestId);
  expect(await service.recordLoyaltyRefund(f.r.id, p.row.id, 10000, requestId)).toMatchObject({
    replayed: true,
  });
  expect(await service.getReward(token, claim)).toMatchObject({ status: 'revoked' });
  await expect(
    service.recordLoyaltyRefund(f.r.id, p.row.id, 30000, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 400 });
});
it('flags already-redeemed refunds for owner review without clawing back served food', async () => {
  const f = await fixture(),
    p = await paid(f, '2026-09-01', '300');
  const [, claim] = rewardLink(p.links);
  await service.redeemReward(f.r.id, claim);
  await service.recordLoyaltyRefund(f.r.id, p.row.id, 1, randomUUID());
  expect((await service.ownerEngagement(f.r.id)).rewards[0]).toMatchObject({
    refund_review: true,
    revoked: false,
  });
});
it('refund of a full visit revokes a seven-date reward', async () => {
  const f = await fixture();
  const payments = [];
  for (let i = 1; i <= 7; i++) payments.push(await paid(f, `2026-09-0${i}`));
  const [token, claim] = rewardLink(payments[6].links);
  await service.recordLoyaltyRefund(f.r.id, payments[0].row.id, 10000, randomUUID());
  expect(await service.getReward(token, claim)).toMatchObject({ status: 'revoked' });
});
it('only publishes paid-visit reviews after moderation and prevents duplicate submission', async () => {
  const f = await fixture(),
    p = await paid(f, '2026-09-01');
  const token = p.links.find((x) => x.includes('/visit#'))!.split('#')[1];
  expect(await service.reviewVisit(token)).toMatchObject({ submitted: false });
  await service.reviewVisit(token, { rating: 5, body: 'Lovely food' });
  await expect(service.reviewVisit(token, { rating: 5, body: 'Duplicate' })).rejects.toMatchObject({
    statusCode: 409,
  });
  expect((await service.publicEngagement(f.r.restaurantToken)).reviews).toHaveLength(0);
  await expect(service.moderateReview(randomUUID(), p.row.id, 'published')).rejects.toMatchObject({
    statusCode: 404,
  });
  await service.moderateReview(f.r.id, p.row.id, 'published');
  const published = await service.publicEngagement(f.r.restaurantToken);
  expect(published.reviews[0]).toMatchObject({ rating: 5, body: 'Lovely food' });
  expect(JSON.stringify(published)).not.toContain('buyer@example.test');
  await service.moderateReview(f.r.id, p.row.id, 'hidden');
  expect((await service.publicEngagement(f.r.restaurantToken)).reviews).toHaveLength(0);
});
it('validates settings, review ratings and locks timezone once accounting begins', async () => {
  const f = await fixture();
  expect(() => service.validateLoyaltySettings({ ...settings, thresholdCents: -1 })).toThrow();
  expect(() => service.validateLoyaltySettings({ ...settings, timezone: 'invalid' })).toThrow();
  await paid(f, '2026-09-01');
  await expect(
    service.saveLoyaltySettings(f.r.id, { ...settings, timezone: 'UTC' }),
  ).rejects.toMatchObject({ statusCode: 409 });
  await expect(service.reviewVisit('f'.repeat(64), { rating: 6, body: '' })).rejects.toMatchObject({
    statusCode: 400,
  });
});
it('stores only hashes of claim secrets in loyalty tables', async () => {
  const f = await fixture(),
    p = await paid(f, '2026-09-01', '300');
  const [token, claim] = rewardLink(p.links);
  const row = (await pool.query('SELECT * FROM loyalty_rewards')).rows[0];
  expect(row.token_hash).toBe(digest(token));
  expect(row.claim_hash).toBe(digest(claim));
  expect(JSON.stringify(row)).not.toContain(token);
  expect(JSON.stringify(row)).not.toContain('buyer@example.test');
});
