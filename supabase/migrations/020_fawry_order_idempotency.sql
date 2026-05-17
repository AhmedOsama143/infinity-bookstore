-- Slice 2 of the Fawry integration. Adds idempotency tracking to orders so
-- that a retried POST /api/orders/create with the same key returns the same
-- order instead of double-charging the customer.
--
-- The key is scoped per student: two different customers may legitimately
-- send the same UUID. Storing it on `orders` (not a side table) keeps lookup
-- to a single index hit and lets the column live and die with the order.

ALTER TABLE orders
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX uq_orders_idempotency
  ON orders (student_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN orders.idempotency_key IS
  'Client-supplied Idempotency-Key header from POST /api/orders/create. Scoped per student. Nullable — only set for orders created via the Fawry flow.';
