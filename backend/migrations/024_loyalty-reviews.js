exports.up = (pgm) =>
  pgm.sql(`
CREATE TABLE loyalty_settings (
 restaurant_id uuid PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false, scheme text NOT NULL DEFAULT 'visits' CHECK(scheme IN ('visits','spend','both')),
 visit_reward text NOT NULL DEFAULT 'Complimentary treat', spend_reward text NOT NULL DEFAULT 'Complimentary treat',
 threshold_cents bigint NOT NULL DEFAULT 30000 CHECK(threshold_cents BETWEEN 1 AND 9999999999),
 expiry_days integer NOT NULL DEFAULT 30 CHECK(expiry_days BETWEEN 1 AND 365), timezone text NOT NULL DEFAULT 'Asia/Kolkata'
);
CREATE TABLE loyalty_payments (
 order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 identity_hash text NOT NULL, paid_day date NOT NULL, amount_cents bigint NOT NULL CHECK(amount_cents>=0),
 refunded_cents bigint NOT NULL DEFAULT 0 CHECK(refunded_cents>=0 AND refunded_cents<=amount_cents)
);
CREATE INDEX loyalty_customer_days ON loyalty_payments(restaurant_id,identity_hash,paid_day);
CREATE TABLE loyalty_rewards (
 id uuid PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 identity_hash text NOT NULL, kind text NOT NULL CHECK(kind IN ('visits','spend')), reward text NOT NULL,
 earned_day date NOT NULL, cycle_after date, threshold_cents bigint NOT NULL,
 token_hash text NOT NULL UNIQUE, claim_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW(), redeemed_at timestamptz,
 revoked boolean NOT NULL DEFAULT false, refund_review boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX loyalty_daily_spend ON loyalty_rewards(restaurant_id,identity_hash,earned_day) WHERE kind='spend';
CREATE INDEX loyalty_rewards_customer ON loyalty_rewards(restaurant_id,identity_hash,kind);
CREATE TABLE loyalty_refunds (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 request_id uuid NOT NULL UNIQUE, amount_cents bigint NOT NULL CHECK(amount_cents>0),
 created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TABLE customer_reviews (
 order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, rating integer CHECK(rating BETWEEN 1 AND 5),
 body text CHECK(length(body)<=1000), status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','pending','published','hidden')),
 created_at timestamptz NOT NULL DEFAULT NOW(), submitted_at timestamptz
);
`);
exports.down = (pgm) =>
  pgm.sql(
    'DROP TABLE customer_reviews,loyalty_refunds,loyalty_rewards,loyalty_payments,loyalty_settings',
  );
