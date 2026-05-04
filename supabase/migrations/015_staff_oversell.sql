-- Phase B — Stock Integrity Agent: staff oversell support.
--
-- The customer-facing OUT_OF_STOCK guarantee is preserved exactly. Only
-- dashboard-originated orders (orders.order_source = 'dashboard') may exceed
-- available stock; the overage is captured per line in
-- order_items.oversold_quantity and never enters branch_stock — physical stock
-- can only ever be reduced by the fulfillable portion. Backorders are
-- discoverable via the partial index below.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS oversold_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_oversold_check;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_oversold_check
  CHECK (oversold_quantity >= 0 AND oversold_quantity <= quantity);

CREATE INDEX IF NOT EXISTS idx_order_items_oversold
  ON order_items(order_id)
  WHERE oversold_quantity > 0;

-- ============================================================================
-- Reservation: branch on order_source.
-- Customer storefront → strict block (unchanged).
-- Dashboard staff sale → reserve fulfillable portion, stash overage on the row.
-- ============================================================================
CREATE OR REPLACE FUNCTION reserve_stock_on_item_insert() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_branch       UUID;
  v_source       TEXT;
  v_available    INTEGER;
  v_fulfillable  INTEGER;
  v_oversold     INTEGER;
  v_hold_hours   INTEGER;
BEGIN
  SELECT branch_id, order_source INTO v_branch, v_source
    FROM orders WHERE id = NEW.order_id;

  SELECT reservation_hold_hours INTO v_hold_hours FROM site_settings WHERE id = 1;

  SELECT (quantity - reserved_quantity) INTO v_available
    FROM branch_stock WHERE branch_id = v_branch AND book_id = NEW.book_id
    FOR UPDATE;

  IF v_source = 'dashboard' THEN
    -- Staff are ground truth for offline events. If the SKU isn't tracked at
    -- this branch yet, attach a zero-row so the reservation still has somewhere
    -- to live and the back-in-stock alert path still works once stock arrives.
    IF v_available IS NULL THEN
      INSERT INTO branch_stock (branch_id, book_id, quantity, reserved_quantity)
        VALUES (v_branch, NEW.book_id, 0, 0)
        ON CONFLICT (branch_id, book_id) DO NOTHING;
      v_available := 0;
    END IF;

    v_fulfillable := LEAST(NEW.quantity, GREATEST(v_available, 0));
    v_oversold    := NEW.quantity - v_fulfillable;
    NEW.oversold_quantity := v_oversold;

    IF v_fulfillable > 0 THEN
      UPDATE branch_stock
        SET reserved_quantity = reserved_quantity + v_fulfillable
        WHERE branch_id = v_branch AND book_id = NEW.book_id;
    END IF;

  ELSE
    -- Customer path: strict, unchanged from Phase A.
    IF v_available IS NULL OR v_available < NEW.quantity THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: book % not available at branch % (need %, avail %)',
        NEW.book_id, v_branch, NEW.quantity, COALESCE(v_available, 0)
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE branch_stock
      SET reserved_quantity = reserved_quantity + NEW.quantity
      WHERE branch_id = v_branch AND book_id = NEW.book_id;
  END IF;

  UPDATE orders
    SET reservation_expires_at = COALESCE(
      reservation_expires_at,
      now() + (v_hold_hours || ' hours')::interval
    )
    WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- Settle: only fulfillable units (quantity − oversold_quantity) move stock.
-- The overage is a debt against future inbound — it never decremented physical
-- stock and is never restored on cancel.
-- ============================================================================
CREATE OR REPLACE FUNCTION settle_stock_on_order_status() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  r              RECORD;
  v_fulfillable  INTEGER;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('confirmed', 'ready', 'completed') THEN
    FOR r IN SELECT book_id, quantity, oversold_quantity FROM order_items WHERE order_id = NEW.id LOOP
      v_fulfillable := r.quantity - r.oversold_quantity;
      IF v_fulfillable > 0 THEN
        UPDATE branch_stock
          SET quantity = quantity - v_fulfillable,
              reserved_quantity = reserved_quantity - v_fulfillable
          WHERE branch_id = NEW.branch_id AND book_id = r.book_id;
      END IF;
    END LOOP;

  ELSIF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    FOR r IN SELECT book_id, quantity, oversold_quantity FROM order_items WHERE order_id = NEW.id LOOP
      v_fulfillable := r.quantity - r.oversold_quantity;
      IF v_fulfillable > 0 THEN
        UPDATE branch_stock
          SET reserved_quantity = reserved_quantity - v_fulfillable
          WHERE branch_id = NEW.branch_id AND book_id = r.book_id;
      END IF;
    END LOOP;

  ELSIF OLD.status IN ('confirmed', 'ready') AND NEW.status = 'cancelled' THEN
    FOR r IN SELECT book_id, quantity, oversold_quantity FROM order_items WHERE order_id = NEW.id LOOP
      v_fulfillable := r.quantity - r.oversold_quantity;
      IF v_fulfillable > 0 THEN
        UPDATE branch_stock
          SET quantity = quantity + v_fulfillable
          WHERE branch_id = NEW.branch_id AND book_id = r.book_id;
      END IF;
    END LOOP;
    NEW.cancelled_at := now();
  END IF;

  RETURN NEW;
END;
$$;
