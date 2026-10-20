import crypto from 'crypto';
import type { PoolClient } from 'pg';
import pool from '../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../errors';

type Db = Pick<PoolClient, 'query'>;
const emailReady = () =>
  process.env.CUSTOMER_EMAIL_ORDERING_ENABLED === 'true' &&
  process.env.PAYMENT_RECEIPT_EMAIL_ENABLED === 'true';
export const loyaltyEnabled = () => emailReady() && process.env.LOYALTY_ENABLED === 'true';
export const reviewsEnabled = () => emailReady() && process.env.CUSTOMER_REVIEWS_ENABLED === 'true';
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const identity = (email: string) => hash(email.trim().toLowerCase());
const secret = () => crypto.randomBytes(32).toString('hex');
function requireFeature(enabled: boolean) {
  if (!enabled) throw new NotFoundError('Feature not available');
}
function capability(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new NotFoundError('Link not available');
  return hash(value);
}
export function validateLoyaltySettings(input: Record<string, unknown>) {
  const { enabled, scheme, visitReward, spendReward, thresholdCents, expiryDays, timezone } = input;
  if (
    typeof enabled !== 'boolean' ||
    !['visits', 'spend', 'both'].includes(String(scheme)) ||
    typeof visitReward !== 'string' ||
    !visitReward.trim() ||
    visitReward.trim().length > 160 ||
    typeof spendReward !== 'string' ||
    !spendReward.trim() ||
    spendReward.trim().length > 160 ||
    !Number.isSafeInteger(thresholdCents) ||
    Number(thresholdCents) < 1 ||
    Number(thresholdCents) > 9999999999 ||
    !Number.isInteger(expiryDays) ||
    Number(expiryDays) < 1 ||
    Number(expiryDays) > 365 ||
    typeof timezone !== 'string' ||
    timezone.length > 80
  ) {
    throw new ValidationError('Enter valid loyalty settings');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  } catch {
    throw new ValidationError('Invalid restaurant timezone');
  }
  return {
    enabled,
    scheme: String(scheme),
    visitReward: visitReward.trim(),
    spendReward: spendReward.trim(),
    thresholdCents: Number(thresholdCents),
    expiryDays: Number(expiryDays),
    timezone,
  };
}
export async function getLoyaltySettings(restaurantId: string) {
  requireFeature(loyaltyEnabled());
  const row = (
    await pool.query('SELECT * FROM loyalty_settings WHERE restaurant_id=$1', [restaurantId])
  ).rows[0];
  return row
    ? {
        enabled: row.enabled,
        scheme: row.scheme,
        visitReward: row.visit_reward,
        spendReward: row.spend_reward,
        thresholdCents: Number(row.threshold_cents),
        expiryDays: row.expiry_days,
        timezone: row.timezone,
      }
    : {
        enabled: false,
        scheme: 'visits',
        visitReward: 'Complimentary treat',
        spendReward: 'Complimentary treat',
        thresholdCents: 30000,
        expiryDays: 30,
        timezone: 'Asia/Kolkata',
      };
}
export async function saveLoyaltySettings(restaurantId: string, input: Record<string, unknown>) {
  requireFeature(loyaltyEnabled());
  const s = validateLoyaltySettings(input);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM restaurants WHERE id=$1 FOR UPDATE', [restaurantId]);
    const old = (
      await client.query('SELECT timezone FROM loyalty_settings WHERE restaurant_id=$1', [
        restaurantId,
      ])
    ).rows[0];
    if (
      old &&
      old.timezone !== s.timezone &&
      (
        await client.query('SELECT 1 FROM loyalty_payments WHERE restaurant_id=$1 LIMIT 1', [
          restaurantId,
        ])
      ).rowCount
    ) {
      throw new ConflictError('Timezone cannot change after loyalty visits have started');
    }
    await client.query(
      `INSERT INTO loyalty_settings(restaurant_id,enabled,scheme,visit_reward,spend_reward,threshold_cents,expiry_days,timezone)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(restaurant_id) DO UPDATE SET enabled=$2,scheme=$3,visit_reward=$4,
      spend_reward=$5,threshold_cents=$6,expiry_days=$7,timezone=$8`,
      [
        restaurantId,
        s.enabled,
        s.scheme,
        s.visitReward,
        s.spendReward,
        s.thresholdCents,
        s.expiryDays,
        s.timezone,
      ],
    );
    await client.query('COMMIT');
    return s;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
async function lockCustomer(db: Db, restaurantId: string, key: string) {
  await db.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('loyalty:' || $1 || ':' || $2,0))",
    [restaurantId, key],
  );
}
function customerBase() {
  const url = new URL(process.env.CUSTOMER_BASE_URL || 'http://127.0.0.1:3001');
  if (
    url.protocol !== 'https:' &&
    !(
      process.env.NODE_ENV !== 'production' &&
      url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(url.hostname)
    )
  ) {
    throw new Error('CUSTOMER_BASE_URL must use HTTPS');
  }
  return url.origin;
}
// Called inside the order's paid transaction. Only newly paid orders enter this ledger.
export async function recordPaidEngagement(
  db: Db,
  order: {
    id: string;
    restaurant_id: string;
    customer_email?: string;
    payment_received_at: Date;
    total: string;
  },
): Promise<string[]> {
  if (!order.customer_email) return [];
  const links: string[] = [];
  if (reviewsEnabled()) {
    const token = secret();
    const inserted = await db.query(
      `INSERT INTO customer_reviews(order_id,restaurant_id,token_hash) VALUES($1,$2,$3)
      ON CONFLICT(order_id) DO NOTHING`,
      [order.id, order.restaurant_id, hash(token)],
    );
    if (inserted.rowCount) links.push(`Review your visit: ${customerBase()}/visit#${token}`);
  }
  if (!loyaltyEnabled()) return links;
  // Share-lock the restaurant so settings cannot change halfway through a payment.
  await db.query('SELECT id FROM restaurants WHERE id=$1 FOR SHARE', [order.restaurant_id]);
  const settings = (
    await db.query('SELECT * FROM loyalty_settings WHERE restaurant_id=$1 AND enabled=true', [
      order.restaurant_id,
    ])
  ).rows[0];
  if (!settings) return links;
  const key = identity(order.customer_email);
  await lockCustomer(db, order.restaurant_id, key);
  const dated = (
    await db.query(
      `SELECT to_char(payment_received_at AT TIME ZONE current_setting('TimeZone') AT TIME ZONE $2,'YYYY-MM-DD') AS day
    FROM orders WHERE id=$1 AND status='payment_received' AND payment_received_at IS NOT NULL`,
      [order.id, settings.timezone],
    )
  ).rows[0];
  if (!dated) throw new ConflictError('Only confirmed paid orders qualify');
  const day = dated.day;
  const inserted = await db.query(
    `INSERT INTO loyalty_payments(order_id,restaurant_id,identity_hash,paid_day,amount_cents)
    VALUES($1,$2,$3,$4,round($5::numeric*100)) ON CONFLICT(order_id) DO NOTHING`,
    [order.id, order.restaurant_id, key, day, order.total],
  );
  if (!inserted.rowCount) return links;
  const last = (
    await db.query(
      `SELECT to_char(MAX(redeemed_at AT TIME ZONE $3),'YYYY-MM-DD') AS day FROM loyalty_rewards
    WHERE restaurant_id=$1 AND identity_hash=$2 AND kind='visits'`,
      [order.restaurant_id, key, settings.timezone],
    )
  ).rows[0].day;
  const stats = (
    await db.query(
      `SELECT COUNT(DISTINCT paid_day) FILTER(WHERE $3::date IS NULL OR paid_day>$3::date) AS visits,
    COALESCE(SUM(amount_cents-refunded_cents) FILTER(WHERE paid_day=$4),0) AS spend FROM loyalty_payments
    WHERE restaurant_id=$1 AND identity_hash=$2 AND amount_cents>refunded_cents`,
      [order.restaurant_id, key, last, day],
    )
  ).rows[0];
  links.push(
    `Loyalty: ${Math.min(7, Number(stats.visits))}/7 paid visit dates. Today's qualifying spend: INR ${(Number(stats.spend) / 100).toFixed(2)}.`,
  );
  for (const kind of ['visits', 'spend']) {
    if (settings.scheme !== kind && settings.scheme !== 'both') continue;
    if (
      (kind === 'visits' && Number(stats.visits) < 7) ||
      (kind === 'spend' && Number(stats.spend) < Number(settings.threshold_cents))
    )
      continue;
    const exists = (
      await db.query(
        `SELECT 1 FROM loyalty_rewards WHERE restaurant_id=$1 AND identity_hash=$2 AND kind=$3 AND
      ${kind === 'spend' ? 'earned_day=$4::date' : 'revoked=false AND redeemed_at IS NULL AND expires_at>NOW()'}`,
        kind === 'spend' ? [order.restaurant_id, key, kind, day] : [order.restaurant_id, key, kind],
      )
    ).rowCount;
    if (exists) continue;
    const token = secret(),
      claim = secret();
    await db.query(
      `INSERT INTO loyalty_rewards(id,restaurant_id,identity_hash,kind,reward,earned_day,cycle_after,threshold_cents,token_hash,claim_hash,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()+($11*INTERVAL '1 day'))`,
      [
        crypto.randomUUID(),
        order.restaurant_id,
        key,
        kind,
        kind === 'visits' ? settings.visit_reward : settings.spend_reward,
        day,
        last,
        kind === 'visits' ? 7 : settings.threshold_cents,
        hash(token),
        hash(claim),
        settings.expiry_days,
      ],
    );
    // The claim secret travels only in the email fragment; public API returns no identity/history.
    links.push(
      `${kind === 'visits' ? 'Seven-day' : 'Daily spend'} reward: ${customerBase()}/reward#${token}.${claim}`,
    );
  }
  return links;
}
export async function getReward(token: unknown, claim: unknown) {
  requireFeature(loyaltyEnabled());
  const row = (
    await pool.query(
      `SELECT w.reward,w.kind,w.expires_at,w.redeemed_at,w.revoked,r.name FROM loyalty_rewards w
    JOIN restaurants r ON r.id=w.restaurant_id JOIN owners o ON o.id=r.owner_id
    WHERE w.token_hash=$1 AND w.claim_hash=$2 AND r.status='active' AND o.status='active'`,
      [capability(token), capability(claim)],
    )
  ).rows[0];
  if (!row) throw new NotFoundError('Link not available');
  return {
    restaurant: row.name,
    reward: row.reward,
    kind: row.kind,
    expiresAt: row.expires_at,
    status: row.redeemed_at
      ? 'redeemed'
      : row.revoked
        ? 'revoked'
        : new Date(row.expires_at) <= new Date()
          ? 'expired'
          : 'available',
  };
}
export async function redeemReward(restaurantId: string, code: unknown) {
  requireFeature(loyaltyEnabled());
  const digest = capability(code),
    client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = (
      await client.query(
        'SELECT identity_hash FROM loyalty_rewards WHERE restaurant_id=$1 AND claim_hash=$2',
        [restaurantId, digest],
      )
    ).rows[0];
    if (!found) throw new NotFoundError('Reward not available');
    await lockCustomer(client, restaurantId, found.identity_hash);
    const row = (
      await client.query(
        'SELECT * FROM loyalty_rewards WHERE restaurant_id=$1 AND claim_hash=$2 FOR UPDATE',
        [restaurantId, digest],
      )
    ).rows[0];
    if (row.redeemed_at) {
      await client.query('COMMIT');
      return { reward: row.reward, status: 'redeemed', replayed: true };
    }
    if (row.revoked || new Date(row.expires_at) <= new Date())
      throw new ConflictError('Reward expired or revoked');
    await client.query('UPDATE loyalty_rewards SET redeemed_at=NOW() WHERE id=$1', [row.id]);
    await client.query('COMMIT');
    return { reward: row.reward, status: 'redeemed', replayed: false };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
export async function inspectReward(restaurantId: string, code: unknown) {
  requireFeature(loyaltyEnabled());
  const row = (
    await pool.query(
      'SELECT reward,kind,expires_at,redeemed_at,revoked FROM loyalty_rewards WHERE restaurant_id=$1 AND claim_hash=$2',
      [restaurantId, capability(code)],
    )
  ).rows[0];
  if (!row) throw new NotFoundError('Reward not available');
  return {
    reward: row.reward,
    kind: row.kind,
    status: row.redeemed_at
      ? 'redeemed'
      : row.revoked
        ? 'revoked'
        : new Date(row.expires_at) <= new Date()
          ? 'expired'
          : 'available',
  };
}
// Accounting only: this never initiates a bank refund or alters an order's payment status.
export async function recordLoyaltyRefund(
  restaurantId: string,
  orderId: string,
  amountCents: unknown,
  requestId: string,
) {
  requireFeature(loyaltyEnabled());
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (
    !Number.isSafeInteger(amountCents) ||
    Number(amountCents) < 1 ||
    !uuid.test(requestId || '') ||
    typeof orderId !== 'string' ||
    (!uuid.test(orderId) && !/^ORD-[A-Z0-9]{6}$/.test(orderId))
  )
    throw new ValidationError('Invalid refund accounting request');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ledger = (
      await client.query(
        `SELECT p.* FROM loyalty_payments p JOIN orders o ON o.id=p.order_id
      WHERE (p.order_id::text=$1 OR o.order_ref=$1) AND p.restaurant_id=$2`,
        [orderId, restaurantId],
      )
    ).rows[0];
    if (!ledger) throw new NotFoundError('Loyalty payment not found');
    orderId = ledger.order_id;
    await lockCustomer(client, restaurantId, ledger.identity_hash);
    const prior = (
      await client.query('SELECT * FROM loyalty_refunds WHERE request_id=$1', [requestId])
    ).rows[0];
    if (prior) {
      if (prior.order_id !== orderId || Number(prior.amount_cents) !== amountCents)
        throw new ConflictError('Refund request already used');
      await client.query('COMMIT');
      return { recorded: true, replayed: true };
    }
    const updated = await client.query(
      `UPDATE loyalty_payments SET refunded_cents=refunded_cents+$3 WHERE order_id=$1 AND restaurant_id=$2
      AND refunded_cents+$3<=amount_cents RETURNING order_id`,
      [orderId, restaurantId, amountCents],
    );
    if (!updated.rowCount) throw new ValidationError('Refund exceeds qualifying payment');
    await client.query(
      'INSERT INTO loyalty_refunds(id,order_id,request_id,amount_cents) VALUES($1,$2,$3,$4)',
      [crypto.randomUUID(), orderId, requestId, amountCents],
    );
    const rewards = (
      await client.query(
        'SELECT * FROM loyalty_rewards WHERE restaurant_id=$1 AND identity_hash=$2 FOR UPDATE',
        [restaurantId, ledger.identity_hash],
      )
    ).rows;
    for (const reward of rewards) {
      const result = (
        await client.query(
          `SELECT COUNT(DISTINCT paid_day) FILTER(WHERE ($3::date IS NULL OR paid_day>$3::date) AND paid_day<=$4::date) AS visits,
        COALESCE(SUM(amount_cents-refunded_cents) FILTER(WHERE paid_day=$4::date),0) AS spend
        FROM loyalty_payments WHERE restaurant_id=$1 AND identity_hash=$2 AND amount_cents>refunded_cents`,
          [restaurantId, ledger.identity_hash, reward.cycle_after, reward.earned_day],
        )
      ).rows[0];
      if (
        Number(reward.kind === 'visits' ? result.visits : result.spend) <
        Number(reward.threshold_cents)
      ) {
        await client.query(
          'UPDATE loyalty_rewards SET revoked=CASE WHEN redeemed_at IS NULL THEN true ELSE revoked END,refund_review=CASE WHEN redeemed_at IS NOT NULL THEN true ELSE refund_review END WHERE id=$1',
          [reward.id],
        );
      }
    }
    await client.query('COMMIT');
    return { recorded: true, replayed: false };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
export async function ownerEngagement(restaurantId: string) {
  const rewards = loyaltyEnabled()
    ? (
        await pool.query(
          `SELECT id,reward,kind,earned_day,expires_at,redeemed_at,revoked,refund_review FROM loyalty_rewards
    WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 100`,
          [restaurantId],
        )
      ).rows
    : [];
  const reviews = reviewsEnabled()
    ? (
        await pool.query(
          `SELECT order_id,rating,body,status,submitted_at FROM customer_reviews WHERE restaurant_id=$1 AND rating IS NOT NULL ORDER BY submitted_at DESC LIMIT 100`,
          [restaurantId],
        )
      ).rows
    : [];
  return { rewards, reviews };
}
export async function reviewVisit(token: unknown, input?: { rating: unknown; body: unknown }) {
  requireFeature(reviewsEnabled());
  const digest = capability(token);
  if (
    input &&
    (!Number.isInteger(input.rating) ||
      Number(input.rating) < 1 ||
      Number(input.rating) > 5 ||
      typeof input.body !== 'string' ||
      input.body.trim().length > 1000)
  )
    throw new ValidationError('Choose 1 to 5 stars and at most 1000 characters');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (
      await client.query(
        `SELECT v.*,r.name FROM customer_reviews v JOIN restaurants r ON r.id=v.restaurant_id
      JOIN owners o ON o.id=r.owner_id JOIN orders q ON q.id=v.order_id WHERE v.token_hash=$1 AND r.status='active' AND o.status='active'
      AND q.status='payment_received' AND v.created_at>NOW()-INTERVAL '30 days' FOR UPDATE OF v`,
        [digest],
      )
    ).rows[0];
    if (!row) throw new NotFoundError('Review link expired or unavailable');
    if (input) {
      if (row.rating !== null) throw new ConflictError('Your review has already been submitted');
      await client.query(
        "UPDATE customer_reviews SET rating=$2,body=$3,status='pending',submitted_at=NOW() WHERE order_id=$1",
        [row.order_id, input.rating, String(input.body).trim()],
      );
    }
    await client.query('COMMIT');
    return { restaurant: row.name, submitted: input ? true : row.rating !== null };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
export async function moderateReview(restaurantId: string, orderId: string, status: unknown) {
  requireFeature(reviewsEnabled());
  if (!['published', 'hidden'].includes(String(status)) || !/^[a-f0-9-]{36}$/i.test(orderId))
    throw new ValidationError('Invalid review action');
  const result = await pool.query(
    'UPDATE customer_reviews SET status=$3 WHERE restaurant_id=$1 AND order_id=$2 AND rating IS NOT NULL',
    [restaurantId, orderId, status],
  );
  if (!result.rowCount) throw new NotFoundError('Review not found');
  return { status };
}
export async function publicEngagement(token: string) {
  if (!/^[A-Za-z0-9]{8,80}$/.test(token)) throw new NotFoundError('Menu not found');
  const row = (
    await pool.query(
      `SELECT r.id,r.name,r.business_upi_id AS upi_id FROM restaurants r JOIN owners o ON o.id=r.owner_id
    WHERE r.restaurant_token=$1 AND r.status='active' AND o.status='active'`,
      [token],
    )
  ).rows[0];
  if (!row) throw new NotFoundError('Menu not found');
  const settings = loyaltyEnabled() ? await getLoyaltySettings(row.id) : null;
  const reviews = reviewsEnabled()
    ? (
        await pool.query(
          `SELECT rating,body,submitted_at FROM customer_reviews WHERE restaurant_id=$1 AND status='published' ORDER BY submitted_at DESC LIMIT 30`,
          [row.id],
        )
      ).rows
    : [];
  const summary = reviewsEnabled()
    ? (
        await pool.query(
          "SELECT COUNT(*)::int AS count,ROUND(AVG(rating),1) AS average FROM customer_reviews WHERE restaurant_id=$1 AND status='published'",
          [row.id],
        )
      ).rows[0]
    : { count: 0, average: null };
  let payment = null;
  if (
    process.env.ORDER_PAYMENTS_ENABLED === 'true' &&
    /^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]{1,}$/.test(row.upi_id || '')
  ) {
    const params = new URLSearchParams({ pa: row.upi_id, pn: row.name, cu: 'INR' });
    const url = `upi://pay?${params}`;
    payment = {
      upiId: row.upi_id,
      url,
      qr: await (await import('qrcode')).toDataURL(url, { width: 280, margin: 2 }),
    };
  }
  return {
    name: row.name,
    loyalty: settings?.enabled ? settings : null,
    reviewsEnabled: reviewsEnabled(),
    reviews,
    summary,
    payment,
  };
}
