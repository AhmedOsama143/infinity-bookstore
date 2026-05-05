-- Allow cancellation of completed orders (e.g. student returns book after pickup).
-- Mirrors the confirmed/ready → cancelled branch: physical stock was already
-- decremented at the pending → completed transition, so we restore the
-- fulfillable portion. The oversold portion never touched branch_stock and is
-- not restored, matching the existing semantics from migration 015.

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

  ELSIF OLD.status IN ('confirmed', 'ready', 'completed') AND NEW.status = 'cancelled' THEN
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
