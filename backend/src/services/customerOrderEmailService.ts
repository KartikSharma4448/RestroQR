import crypto from 'crypto';
import type { PoolClient } from 'pg';
import pool from '../config/database';
import { AppError, ValidationError } from '../errors';
import { EmailDeliveryError, sendTransactionalEmail } from './emailService';

export const customerEmailOrderingEnabled = () => process.env.CUSTOMER_EMAIL_ORDERING_ENABLED === 'true';
export const orderLifecycleEmailEnabled = () => customerEmailOrderingEnabled() && process.env.ORDER_LIFECYCLE_EMAIL_ENABLED === 'true';
export const paymentReceiptEmailEnabled = () => customerEmailOrderingEnabled() && process.env.PAYMENT_RECEIPT_EMAIL_ENABLED === 'true';
export function validateCustomerEmail(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Enter your email address');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email) ||
      email.startsWith('.') || email.includes('..') || email.includes('.@')) {
    throw new ValidationError('Enter a valid email address');
  }
  return email;
}
export function validateOrderRequestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ValidationError('A valid checkout request ID is required');
  }
  return value.toLowerCase();
}
export function orderFingerprint(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
type Db = Pick<PoolClient, 'query'>;

export async function checkCustomerEmailLimit(client: Db, email: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('customer-order-email:' || $1,0))", [email]);
  const count = (await client.query(`SELECT COUNT(*) FILTER (WHERE created_at>NOW()-INTERVAL '15 minutes') AS recent,
    COUNT(*) AS daily FROM orders WHERE customer_email=$1 AND created_at>NOW()-INTERVAL '1 day'`, [email])).rows[0];
  if (Number(count.recent) >= 5 || Number(count.daily) >= 20) {
    throw new AppError('Too many recent orders for this email. Please contact the restaurant.', 429, 'RATE_LIMITED');
  }
}

export interface ConfirmationOrder { id: string; orderRef: string; total: string;
  items: { itemName: string; quantity: number; itemPrice: string; optionSummary?: string }[] }
export async function queueOrderStatusEmail(client: Db, email: string, restaurantId: string,
  order: ConfirmationOrder & { customerName?: string | null; tableName?: string }, kind: 'order-accepted' | 'order-ready') {
  const restaurant = (await client.query('SELECT name,address FROM restaurants WHERE id=$1',[restaurantId])).rows[0];
  const name = String(restaurant?.name || 'Restaurant').replace(/[\r\n]/g,' ').slice(0,100);
  const status = kind === 'order-accepted' ? 'Order accepted - preparation in progress' : 'Your order is ready';
  const text = [name, String(restaurant?.address || ''), '', status,
    `Order: ${order.orderRef}`, `Customer: ${order.customerName || 'Guest'}`,
    ...(order.tableName ? [`Table: ${order.tableName}`] : []), '',
    ...order.items.map(item => `${item.quantity} x ${item.itemName}${item.optionSummary ? ` (${item.optionSummary})` : ''}: INR ${(Math.round(Number(item.itemPrice)*100)*item.quantity/100).toFixed(2)}`),
    '', `Total: INR ${order.total}`, '', kind === 'order-accepted'
      ? 'The restaurant has accepted your order and is preparing it. We will notify you when it is ready.'
      : 'Your food is ready. Please check with the restaurant for serving or collection.',
    'This is an order update, not a payment receipt or tax invoice.'].join('\n');
  await client.query(`INSERT INTO order_email_outbox(id,order_id,recipient,subject,body,sender,kind)
    VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (order_id,kind) DO NOTHING`,
    [crypto.randomUUID(),order.id,validateCustomerEmail(email),`${name}: ${status} ${order.orderRef}`,text,
      process.env.RESEND_FROM_EMAIL?.trim() || null,kind]);
}
export async function queueOrderConfirmation(client: Db, email: string, restaurantId: string, order: ConfirmationOrder) {
  const row = (await client.query('SELECT name FROM restaurants WHERE id=$1', [restaurantId])).rows[0];
  const name = String(row?.name || 'Restaurant').replace(/[\r\n]/g, ' ').slice(0, 100);
  const text = [`${name} - order ${order.orderRef}`, '',
    ...order.items.map(item => `${item.quantity} x ${item.itemName}${item.optionSummary ? ` (${item.optionSummary})` : ''}: INR ${(Math.round(Number(item.itemPrice) * 100) * item.quantity / 100).toFixed(2)}`),
    '', `Total: INR ${order.total}`, '', 'Your order has been placed with the restaurant.',
    'This is an order confirmation, not a payment receipt or tax invoice.'].join('\n');
  await client.query(`INSERT INTO order_email_outbox (id,order_id,recipient,subject,body,sender)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (order_id,kind) DO NOTHING`,
    [crypto.randomUUID(), order.id, email, `${name}: ${order.orderRef}`, text, process.env.RESEND_FROM_EMAIL?.trim() || null]);
}

export async function queuePaymentReceipt(client: Db, email: string, restaurantId: string,
  order: ConfirmationOrder & { customerName?: string | null; paidAt: Date; receiptLines?: string[] }) {
  const restaurant = (await client.query('SELECT name,address FROM restaurants WHERE id=$1', [restaurantId])).rows[0];
  const name = String(restaurant?.name || 'Restaurant').replace(/[\r\n]/g, ' ').slice(0, 100);
  const text = [name, String(restaurant?.address || ''), '', 'PAYMENT RECEIPT',
    `Receipt: ${order.orderRef}`, `Customer: ${order.customerName || 'Guest'}`,
    `Payment confirmed at: ${order.paidAt.toISOString()}`, '',
    ...order.items.map(item => `${item.quantity} x ${item.itemName}${item.optionSummary ? ` (${item.optionSummary})` : ''}: INR ${(Math.round(Number(item.itemPrice) * 100) * item.quantity / 100).toFixed(2)}`),
    '', `Total paid: INR ${order.total}`, '',
    'Payment receipt confirmed by the restaurant. Thank you for your visit.',
    'This is not a GST tax invoice or independent bank/UPI verification.', '', ...(order.receiptLines || []),
    ...(order.receiptLines?.length ? ['Keep reward/review links private. Only share a reward claim code with restaurant staff when redeeming.'] : [])].join('\n');
  await client.query(`INSERT INTO order_email_outbox (id,order_id,recipient,subject,body,sender,kind)
    VALUES ($1,$2,$3,$4,$5,$6,'payment-receipt') ON CONFLICT (order_id,kind) DO NOTHING`,
    [crypto.randomUUID(), order.id, validateCustomerEmail(email), `${name}: Payment receipt ${order.orderRef}`, text,
      process.env.RESEND_FROM_EMAIL?.trim() || null]);
}

export async function deliverNextOrderEmail(): Promise<boolean> {
  if (!customerEmailOrderingEnabled() || process.env.ORDER_EMAIL_DELIVERY_ENABLED !== 'true') return false;
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) return false;
  const rawCutoff = process.env.ORDER_EMAIL_DELIVERY_NOT_BEFORE;
  if (rawCutoff && !Number.isFinite(Date.parse(rawCutoff))) return false;
  const cutoff = rawCutoff ? new Date(rawCutoff).toISOString() : null;
  // Stop replay after the provider's 24-hour idempotency window (one-hour margin).
  await pool.query(`UPDATE order_email_outbox SET status='uncertain',lease_until=NULL
    WHERE status IN ('pending','sending') AND (first_attempt_at<NOW()-INTERVAL '23 hours'
      OR (status='sending' AND lease_until<NOW() AND attempts>=8))`);
  const token = crypto.randomUUID();
  const job = (await pool.query(`WITH candidate AS (
    SELECT q.id FROM order_email_outbox q WHERE q.attempts<8 AND (
      (q.status='pending' AND q.next_attempt_at<=NOW()) OR (q.status='sending' AND q.lease_until<NOW()))
    AND ($3::timestamptz IS NULL OR q.created_at >= $3)
    AND (NOT $4::boolean OR q.kind <> 'order-confirmation')
    AND NOT EXISTS (SELECT 1 FROM order_email_outbox earlier WHERE earlier.order_id=q.order_id
      AND earlier.status IN ('pending','sending') AND (earlier.created_at,earlier.id)<(q.created_at,q.id)
      AND ($3::timestamptz IS NULL OR earlier.created_at >= $3)
      AND (NOT $4::boolean OR earlier.kind <> 'order-confirmation'))
    ORDER BY q.created_at,q.id FOR UPDATE OF q SKIP LOCKED LIMIT 1)
    UPDATE order_email_outbox AS message SET status='sending',attempts=attempts+1,
      first_attempt_at=COALESCE(first_attempt_at,NOW()),lease_until=NOW()+INTERVAL '2 minutes',lease_token=$1,
      sender=COALESCE(sender,$2)
    FROM candidate WHERE message.id=candidate.id RETURNING message.*`, [token, process.env.RESEND_FROM_EMAIL.trim(),cutoff,orderLifecycleEmailEnabled()])).rows[0];
  if (!job) return false;
  let providerId: string;
  try {
    providerId = await sendTransactionalEmail({ from: job.sender, to: job.recipient, subject: job.subject, text: job.body,
      idempotencyKey: `${job.kind || 'order-confirmation'}/${job.order_id}` });
  } catch (error) {
    const retry = error instanceof EmailDeliveryError && error.retryable && job.attempts < 8;
    await pool.query(`UPDATE order_email_outbox SET status=$1,lease_until=NULL,
      next_attempt_at=NOW()+($2 * INTERVAL '1 second') WHERE id=$3 AND lease_token=$4 AND status='sending'`,
      [retry ? 'pending' : 'failed', Math.min(3600, 30 * 2 ** job.attempts), job.id, token]);
    return true;
  }
  // A DB error here leaves a leased job; retry uses the same provider idempotency key.
  await pool.query(`UPDATE order_email_outbox SET status='sent',provider_id=$1,sent_at=NOW(),lease_until=NULL
    WHERE id=$2 AND lease_token=$3 AND status='sending'`, [providerId, job.id, token]);
  return true;
}

export function startOrderEmailWorker() {
  if (!customerEmailOrderingEnabled() || process.env.ORDER_EMAIL_DELIVERY_ENABLED !== 'true') return () => {};
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      // Small batches avoid blocking ordering requests while retries remain durable.
      await deliverNextOrderEmail();
    } catch { console.error('Order email worker could not complete a cycle'); }
    finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, 15000);
  timer.unref();
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
