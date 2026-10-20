jest.mock('../services/emailService', () => ({ ...jest.requireActual('../services/emailService'), sendTransactionalEmail: jest.fn(async () => 'provider-id') }));
jest.mock('../services/notificationService', () => ({ ...jest.requireActual('../services/notificationService'), sendOrderNotification: jest.fn(async () => undefined) }));
import { randomUUID } from 'crypto';
import { sendTransactionalEmail, EmailDeliveryError } from '../services/emailService';

const url = new URL(process.env.RESTROQR_ACCEPTANCE_DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || !/^\/restroqr_auth_acceptance_[a-z0-9_]+$/.test(url.pathname) || process.env.DATABASE_URL !== process.env.RESTROQR_ACCEPTANCE_DATABASE_URL) {
  throw new Error('Refusing non-isolated acceptance database');
}
const prior = { flow: process.env.CUSTOMER_EMAIL_ORDERING_ENABLED, delivery: process.env.ORDER_EMAIL_DELIVERY_ENABLED };
let pool: import('pg').Pool;
let service: typeof import('../services/customerOrderEmailService');
let createOrder: typeof import('../services/orderService').createOrder;
beforeAll(() => {
  process.env.CUSTOMER_EMAIL_ORDERING_ENABLED = 'true'; process.env.ORDER_EMAIL_DELIVERY_ENABLED = 'true';
  pool = require('../config/database').default; service = require('../services/customerOrderEmailService');
  createOrder = require('../services/orderService').createOrder;
});
beforeEach(async () => {
  process.env.PAYMENT_RECEIPT_EMAIL_ENABLED = 'false';
  await pool.query('TRUNCATE owners RESTART IDENTITY CASCADE');
  jest.clearAllMocks(); (sendTransactionalEmail as jest.Mock).mockResolvedValue('provider-id');
});
afterAll(async () => {
  if (prior.flow === undefined) delete process.env.CUSTOMER_EMAIL_ORDERING_ENABLED; else process.env.CUSTOMER_EMAIL_ORDERING_ENABLED = prior.flow;
  if (prior.delivery === undefined) delete process.env.ORDER_EMAIL_DELIVERY_ENABLED; else process.env.ORDER_EMAIL_DELIVERY_ENABLED = prior.delivery;
  await pool.end();
});
async function fixture() {
  const owner = (await pool.query("INSERT INTO owners(name,email,password_hash) VALUES ('Test Owner','owner@example.test','not-a-login') RETURNING id")).rows[0];
  const { createRestaurant } = require('../services/ownerRestaurantService');
  const restaurant = await createRestaurant({ ownerId: owner.id, name: 'Customer Test Cafe', address: 'Jaipur', phone: '9999999999' });
  await pool.query("UPDATE restaurants SET qr_mode='multi',onboarding_required=false WHERE id=$1", [restaurant.id]);
  const { createTable } = require('../services/tableService');
  const table = await createTable(restaurant.id, 'Table A');
  const category = (await pool.query("INSERT INTO categories(restaurant_id,name) VALUES ($1,'Drinks') RETURNING id", [restaurant.id])).rows[0];
  const { createFoodItem } = require('../services/foodItemService');
  const item = await createFoodItem(restaurant.id, category.id, { name: 'Tea', price: 10, badge: 'veg' });
  const items = [{ itemId: item.id, quantity: 1 }];
  return { restaurant, table, item, items };
}

async function receiptFixture() {
  const f = await fixture();
  process.env.PAYMENT_RECEIPT_EMAIL_ENABLED = 'true';
  const order = await createOrder(f.table.tableToken, f.items, undefined, undefined,
    { customerEmail: 'buyer@example.test', requestId: randomUUID() });
  const update = require('../services/orderService').updateOrderStatus;
  await update(order.id, f.restaurant.id, 'accepted');
  await update(order.id, f.restaurant.id, 'completed');
  return { ...f, order, update };
}

it('queues one private paid receipt only after owner confirmation, including concurrent retries', async () => {
  const f = await receiptFixture();
  expect((await pool.query("SELECT id FROM order_email_outbox WHERE kind='payment-receipt'")).rowCount).toBe(0);
  const results = await Promise.all([f.update(f.order.id, f.restaurant.id, 'payment_received'),
    f.update(f.order.id, f.restaurant.id, 'payment_received')]);
  expect(results.every(order => order.status === 'payment_received')).toBe(true);
  const jobs = (await pool.query('SELECT * FROM order_email_outbox ORDER BY created_at')).rows;
  expect(jobs).toHaveLength(2);
  const receipt = jobs.find(job => job.kind === 'payment-receipt');
  expect(receipt.recipient).toBe('buyer@example.test');
  expect(receipt.body).toContain('Total paid: INR 10.00');
  expect(receipt.body).toContain('1 x Tea: INR 10.00');
  expect(receipt.body).toContain('Customer: Guest');
  expect(receipt.body).toContain('not a GST tax invoice');
  expect(sendTransactionalEmail).not.toHaveBeenCalled();
});

it('rolls back paid status when receipt queue persistence fails', async () => {
  const f = await receiptFixture();
  const spy = jest.spyOn(service, 'queuePaymentReceipt').mockRejectedValueOnce(new Error('queue-failed'));
  try {
    await expect(f.update(f.order.id, f.restaurant.id, 'payment_received')).rejects.toThrow('queue-failed');
    expect((await pool.query('SELECT status FROM orders WHERE id=$1', [f.order.id])).rows[0].status).toBe('completed');
    expect((await pool.query("SELECT id FROM order_email_outbox WHERE kind='payment-receipt'")).rowCount).toBe(0);
  } finally { spy.mockRestore(); }
});

it('uses separate stable provider keys for order confirmation and paid receipt', async () => {
  const f = await receiptFixture();
  await f.update(f.order.id, f.restaurant.id, 'payment_received');
  await service.deliverNextOrderEmail();
  await service.deliverNextOrderEmail();
  const keys = (sendTransactionalEmail as jest.Mock).mock.calls.map(call => call[0].idempotencyKey);
  expect(keys).toEqual([`order-confirmation/${f.order.id}`, `payment-receipt/${f.order.id}`]);
  expect((await pool.query("SELECT id FROM order_email_outbox WHERE status='sent'")).rowCount).toBe(2);
});

it('keeps payment confirmed while a failed receipt retries with the original content and provider key', async () => {
  const f = await receiptFixture();
  await f.update(f.order.id, f.restaurant.id, 'payment_received');
  await service.deliverNextOrderEmail();
  (sendTransactionalEmail as jest.Mock).mockRejectedValueOnce(new EmailDeliveryError(true));
  await service.deliverNextOrderEmail();
  expect((await pool.query('SELECT status FROM orders WHERE id=$1', [f.order.id])).rows[0].status).toBe('payment_received');
  const queued = (await pool.query("SELECT * FROM order_email_outbox WHERE kind='payment-receipt'")).rows[0];
  expect(queued.status).toBe('pending');
  await pool.query("UPDATE food_items SET name='Changed catalog',price=999 WHERE id=$1", [f.item.id]);
  await pool.query("UPDATE restaurants SET name='Changed cafe' WHERE id=$1", [f.restaurant.id]);
  await pool.query("UPDATE order_email_outbox SET next_attempt_at=NOW() WHERE kind='payment-receipt'");
  await service.deliverNextOrderEmail();
  const calls = (sendTransactionalEmail as jest.Mock).mock.calls;
  expect(calls[1][0]).toEqual(calls[2][0]);
  expect(calls[2][0].text).toContain('1 x Tea: INR 10.00');
  expect((await pool.query("SELECT status FROM order_email_outbox WHERE kind='payment-receipt'")).rows[0].status).toBe('sent');
});

it('does not queue a receipt when its rollout flag is disabled', async () => {
  const f = await receiptFixture();
  process.env.PAYMENT_RECEIPT_EMAIL_ENABLED = 'false';
  await f.update(f.order.id, f.restaurant.id, 'payment_received');
  expect((await pool.query("SELECT id FROM order_email_outbox WHERE kind='payment-receipt'")).rowCount).toBe(0);
});

it('rejects cross-restaurant payment confirmation and premature paid transitions', async () => {
  const f = await receiptFixture();
  await expect(f.update(f.order.id, randomUUID(), 'payment_received')).rejects.toMatchObject({ statusCode: 404 });
  await pool.query("UPDATE orders SET status='pending' WHERE id=$1", [f.order.id]);
  await expect(f.update(f.order.id, f.restaurant.id, 'payment_received')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  expect((await pool.query("SELECT id FROM order_email_outbox WHERE kind='payment-receipt'")).rowCount).toBe(0);
});

it('allows legacy orders without email to be marked paid without inventing a recipient', async () => {
  const f = await receiptFixture();
  await pool.query('UPDATE orders SET customer_email=NULL WHERE id=$1', [f.order.id]);
  await expect(f.update(f.order.id, f.restaurant.id, 'payment_received')).resolves.toMatchObject({ status: 'payment_received' });
  expect((await pool.query("SELECT id FROM order_email_outbox WHERE kind='payment-receipt'")).rowCount).toBe(0);
});
it('requires email without OTP and queues a Guest confirmation atomically', async () => {
  const f = await fixture(); const requestId = randomUUID();
  await expect(createOrder(f.table.tableToken, f.items, undefined, undefined, { customerEmail: '', requestId })).rejects.toMatchObject({ statusCode: 400 });
  const order = await createOrder(f.table.tableToken, f.items, '', undefined, { customerEmail: ' Buyer@Example.Test ', requestId });
  expect(order.customerName).toBe('Guest');
  expect((await pool.query('SELECT customer_email,customer_phone FROM orders')).rows[0]).toEqual({ customer_email: 'buyer@example.test', customer_phone: null });
  expect((await pool.query('SELECT status,recipient FROM order_email_outbox')).rows[0]).toEqual({ status: 'pending', recipient: 'buyer@example.test' });
  expect(sendTransactionalEmail).not.toHaveBeenCalled();
});
it('serializes concurrent checkout retries into one order and one email', async () => {
  const f = await fixture(); const checkout = { customerEmail: 'buyer@example.test', requestId: randomUUID() };
  const orders = await Promise.all([createOrder(f.table.tableToken, f.items, undefined, undefined, checkout), createOrder(f.table.tableToken, f.items, undefined, undefined, checkout)]);
  expect(orders[0].id).toBe(orders[1].id);
  expect((await pool.query('SELECT id FROM orders')).rowCount).toBe(1);
  expect((await pool.query('SELECT id FROM order_email_outbox')).rowCount).toBe(1);
  await pool.query('DELETE FROM food_items WHERE id=$1', [f.item.id]);
  expect((await createOrder(f.table.tableToken, f.items, undefined, undefined, checkout)).id).toBe(orders[0].id);
  await expect(createOrder(f.table.tableToken, f.items, undefined, undefined, { ...checkout, customerEmail: 'other@example.test' })).rejects.toMatchObject({ statusCode: 409 });
});
it('keeps accepted orders when mail fails and safely retries the same provider key', async () => {
  const f = await fixture(); await createOrder(f.table.tableToken, f.items, undefined, undefined, { customerEmail: 'buyer@example.test', requestId: randomUUID() });
  (sendTransactionalEmail as jest.Mock).mockRejectedValueOnce(new EmailDeliveryError(true));
  expect(await service.deliverNextOrderEmail()).toBe(true);
  expect((await pool.query('SELECT status,attempts FROM order_email_outbox')).rows[0]).toEqual({ status: 'pending', attempts: 1 });
  expect((await pool.query('SELECT id FROM orders')).rowCount).toBe(1);
  await pool.query('UPDATE order_email_outbox SET next_attempt_at=NOW()');
  await service.deliverNextOrderEmail();
  expect((await pool.query('SELECT status,attempts FROM order_email_outbox')).rows[0]).toEqual({ status: 'sent', attempts: 2 });
  expect((sendTransactionalEmail as jest.Mock).mock.calls[0][0].idempotencyKey).toBe((sendTransactionalEmail as jest.Mock).mock.calls[1][0].idempotencyKey);
});
it('claims one job across concurrent workers and recovers a stale lease', async () => {
  const f = await fixture(); await createOrder(f.table.tableToken, f.items, undefined, undefined, { customerEmail: 'buyer@example.test', requestId: randomUUID() });
  await pool.query("UPDATE order_email_outbox SET status='sending',attempts=1,first_attempt_at=NOW(),lease_until=NOW()-INTERVAL '1 minute',lease_token=$1", [randomUUID()]);
  await Promise.all([service.deliverNextOrderEmail(), service.deliverNextOrderEmail()]);
  expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
  expect((await pool.query('SELECT status FROM order_email_outbox')).rows[0].status).toBe('sent');
});
it('does not risk replaying email beyond the provider idempotency window', async () => {
  const f = await fixture(); await createOrder(f.table.tableToken, f.items, undefined, undefined, { customerEmail: 'buyer@example.test', requestId: randomUUID() });
  await pool.query("UPDATE order_email_outbox SET status='sending',attempts=1,first_attempt_at=NOW()-INTERVAL '24 hours',lease_until=NOW()-INTERVAL '1 hour'");
  expect(await service.deliverNextOrderEmail()).toBe(false);
  expect(sendTransactionalEmail).not.toHaveBeenCalled();
  expect((await pool.query('SELECT status FROM order_email_outbox')).rows[0].status).toBe('uncertain');
});
it('rolls back order creation if its durable email cannot be queued', async () => {
  const f = await fixture(); const spy = jest.spyOn(service, 'queueOrderConfirmation').mockRejectedValueOnce(new Error('queue-write-failed'));
  try {
    await expect(createOrder(f.table.tableToken, f.items, undefined, undefined, { customerEmail: 'buyer@example.test', requestId: randomUUID() })).rejects.toThrow('queue-write-failed');
    expect((await pool.query('SELECT id FROM orders')).rowCount).toBe(0);
    expect((await pool.query('SELECT id FROM order_email_outbox')).rowCount).toBe(0);
  } finally { spy.mockRestore(); }
});
it('limits recipient email bombing without requiring customer authentication', async () => {
  const f = await fixture();
  for (let i = 0; i < 5; i++) await createOrder(f.table.tableToken, f.items, undefined, undefined, { customerEmail: 'buyer@example.test', requestId: randomUUID() });
  await expect(createOrder(f.table.tableToken, f.items, undefined, undefined, { customerEmail: 'buyer@example.test', requestId: randomUUID() })).rejects.toMatchObject({ statusCode: 429 });
  expect((await pool.query('SELECT id FROM orders')).rowCount).toBe(5);
});
it('exposes the welcome metadata but never customer emails on public responses', async () => {
  const f = await fixture(); const request = require('supertest'); const app = require('../index').default;
  const missing = await request(app).post('/api/public/orders').send({ tableToken: f.table.tableToken, items: f.items, requestId: randomUUID() });
  expect(missing.status).toBe(400);
  const result = await request(app).post('/api/public/orders').send({ tableToken: f.table.tableToken, items: f.items,
    requestId: randomUUID(), customerEmail: 'buyer@example.test', customerPhone: '9999999999' });
  expect(result.status).toBe(201); expect(result.body.data.emailConfirmation).toBe('queued');
  expect(JSON.stringify(result.body)).not.toContain('buyer@example.test');
  const menu = await request(app).get('/api/public/menu/' + f.restaurant.restaurantToken);
  expect(menu.body.data.restaurant).toMatchObject({ customerEmailRequired: true, address: 'Jaipur' });
  expect(JSON.stringify(menu.body)).not.toContain('buyer@example.test');
  await pool.query("UPDATE owners SET status='disabled'");
  expect((await request(app).get('/api/public/menu/' + f.restaurant.restaurantToken)).status).toBe(404);
});
it('stops an exhausted crashed job without another provider request', async () => {
  const f = await fixture(); await createOrder(f.table.tableToken, f.items, undefined, undefined, { customerEmail: 'buyer@example.test', requestId: randomUUID() });
  await pool.query("UPDATE order_email_outbox SET status='sending',attempts=8,first_attempt_at=NOW(),lease_until=NOW()-INTERVAL '1 minute'");
  expect(await service.deliverNextOrderEmail()).toBe(false);
  expect(sendTransactionalEmail).not.toHaveBeenCalled();
  expect((await pool.query('SELECT status FROM order_email_outbox')).rows[0].status).toBe('uncertain');
});
