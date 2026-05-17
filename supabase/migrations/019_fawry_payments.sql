-- Slice 1 of the Fawry integration. Extends the existing orders schema and
-- adds the payment_events audit log.
--
-- This migration intentionally diverges from docs/fawry/INTEGRATION_PLAN.md §4.
-- That section was drafted as a from-scratch design and ignores the prior
-- schema (migrations 001–018) which already owns orders, order_items, the
-- per-branch reservation triggers, payment_status, and the payments table.
-- Recreating those tables would orphan the existing COD storefront flow,
-- the cart-hold trigger in 016, and the staff oversell guard in 015.
-- Reconciled here: extend orders with Fawry-specific columns, add a clean
-- payment_events audit log, leave the rest of the schema alone.

-- ============================================================================
-- 1. Extend payment_status enum: PAYATFAWRY references can sit unpaid for up
--    to 72h, after which the cron sweeper marks them 'expired' (distinct from
--    'failed', which is an explicit decline from Fawry).
-- ============================================================================
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'expired';

-- ============================================================================
-- 2. Extend orders with Fawry-tracking columns.
--
-- Notes:
--   • merchant_ref_number is nullable — COD orders never get one. Among
--     Fawry-tracked orders it must be unique, hence a partial unique index.
--   • payment_method (existing enum) stays at the coarse level ('fawry').
--     payment_method_detail captures the actual Fawry sub-method the customer
--     ended up using (CARD, MWALLET, PAYATFAWRY, VALU, ...) — that detail is
--     what Fawry returns on the webhook and what we surface in the staff UI.
--   • payment_amount = total + fawry_fees, populated from the webhook.
--     Kept separate from `total` (our authoritative order amount, computed
--     server-side from the cart) so we can reconcile fee differences without
--     mutating the customer-facing total.
--   • payment_expires_at is distinct from reservation_expires_at: the latter
--     governs branch stock reservation (24h fulfillment window), the former
--     governs the Fawry payment window (72h for PAYATFAWRY refs).
-- ============================================================================
ALTER TABLE orders
  ADD COLUMN merchant_ref_number    TEXT,
  ADD COLUMN fawry_ref_number       TEXT,
  ADD COLUMN fawry_fees             DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (fawry_fees >= 0),
  ADD COLUMN payment_amount         DECIMAL(10, 2) CHECK (payment_amount IS NULL OR payment_amount >= 0),
  ADD COLUMN payment_method_detail  TEXT,
  ADD COLUMN payment_expires_at     TIMESTAMPTZ,
  ADD COLUMN payment_paid_at        TIMESTAMPTZ;

CREATE UNIQUE INDEX orders_merchant_ref_uq
  ON orders (merchant_ref_number)
  WHERE merchant_ref_number IS NOT NULL;

CREATE INDEX idx_orders_fawry_ref
  ON orders (fawry_ref_number)
  WHERE fawry_ref_number IS NOT NULL;

CREATE INDEX idx_orders_payment_expiry
  ON orders (payment_expires_at)
  WHERE payment_status = 'pending' AND payment_expires_at IS NOT NULL;

COMMENT ON COLUMN orders.merchant_ref_number IS
  'merchantRefNumber sent to Fawry on charge request. Convention: equal to id::text. Nullable for COD orders.';
COMMENT ON COLUMN orders.fawry_ref_number IS
  'Fawry reference number returned on the first webhook. For PAYATFAWRY this is the kiosk reference the customer pays against.';
COMMENT ON COLUMN orders.fawry_fees IS
  'Gateway fees charged by Fawry for this transaction (EGP). Returned on the webhook.';
COMMENT ON COLUMN orders.payment_amount IS
  'Total amount Fawry settled (EGP), equal to total + fawry_fees. Populated from the webhook, do not compute on the client.';
COMMENT ON COLUMN orders.payment_method_detail IS
  'Fawry-side payment method the customer used (CARD, MWALLET, PAYATFAWRY, VALU, ...). Distinct from orders.payment_method which only captures the coarse choice (cod/fawry/...) at order placement time.';
COMMENT ON COLUMN orders.payment_expires_at IS
  'Deadline by which Fawry expects payment (mainly relevant for PAYATFAWRY refs). Independent of reservation_expires_at, which governs branch stock holds.';
COMMENT ON COLUMN orders.payment_paid_at IS
  'paymentTime echoed by Fawry on the PAID webhook. Distinct from payments.paid_at to avoid coupling to the existing payments-table flow.';

-- ============================================================================
-- 3. payment_events — audit log of every Fawry webhook + outbound API call.
--
-- Service-role-only (no RLS policies). Inserted FIRST in any handler, before
-- business logic, so we have an audit trail even when downstream processing
-- crashes. Idempotency key for webhooks: (merchant_ref_number, orderStatus)
-- among signature-valid webhook rows.
-- ============================================================================
CREATE TABLE payment_events (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id              UUID REFERENCES orders(id) ON DELETE SET NULL,
  merchant_ref_number   TEXT,
  event_type            TEXT NOT NULL CHECK (event_type IN ('webhook', 'charge_request', 'refund', 'status_poll')),
  raw_payload           JSONB NOT NULL,
  signature_provided    TEXT,
  signature_valid       BOOLEAN,
  fawry_status_code     TEXT,
  processed             BOOLEAN NOT NULL DEFAULT false,
  error_message         TEXT,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_order
  ON payment_events (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX idx_payment_events_merchant_ref
  ON payment_events (merchant_ref_number);

CREATE INDEX idx_payment_events_received
  ON payment_events (received_at DESC);

-- Webhook idempotency: a given merchant ref shouldn't have two valid-signature
-- webhook rows for the same orderStatus. This makes "log first, then process"
-- safe under retries — the second insert for the same (ref, status) raises a
-- unique violation, which the handler treats as "already seen, ack and exit".
CREATE UNIQUE INDEX uq_payment_events_webhook_idem
  ON payment_events (merchant_ref_number, (raw_payload ->> 'orderStatus'))
  WHERE event_type = 'webhook' AND signature_valid = true;

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
-- No policies. The webhook handler and any reconciliation job use the
-- service-role client; nothing in the storefront or staff UI needs RLS-scoped
-- access to this table. Staff dashboards read via the service-role admin
-- routes (the same pattern used by app/api/admin/export).

COMMENT ON TABLE payment_events IS
  'Audit log of every Fawry webhook and outbound Fawry API call. Service-role-only (no RLS policies). Always insert before processing — must survive logic failures downstream. Idempotency key for webhooks: (merchant_ref_number, raw_payload->>orderStatus) among signature-valid rows.';
