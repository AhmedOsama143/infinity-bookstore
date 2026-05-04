-- Order tagging: payment_type (online/offline) and order_source (storefront/dashboard).
-- Stored independently of payment_method so staff can override edge cases
-- (e.g. a "card" order settled in cash, or a manual entry against an online gateway).

CREATE TYPE payment_type AS ENUM ('online', 'offline');
CREATE TYPE order_source AS ENUM ('storefront', 'dashboard');

ALTER TABLE orders
  ADD COLUMN payment_type  payment_type,
  ADD COLUMN order_source  order_source;

-- Backfill existing rows. All historical orders came through the storefront;
-- payment_type is derived from payment_method as a one-time seed.
UPDATE orders
   SET order_source = 'storefront',
       payment_type = CASE
         WHEN payment_method IN ('cod', 'bank_transfer') THEN 'offline'::payment_type
         ELSE 'online'::payment_type
       END
 WHERE payment_type IS NULL OR order_source IS NULL;

-- Lock both columns down. order_source gets a safe default (storefront covers
-- the existing flow); payment_type intentionally has NO default — every insert
-- must specify it, matching the spec's "never auto-assume" rule.
ALTER TABLE orders
  ALTER COLUMN order_source SET DEFAULT 'storefront',
  ALTER COLUMN order_source SET NOT NULL,
  ALTER COLUMN payment_type SET NOT NULL;

CREATE INDEX idx_orders_payment_type ON orders(payment_type);
CREATE INDEX idx_orders_order_source ON orders(order_source);
