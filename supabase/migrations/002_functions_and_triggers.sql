-- Business logic: helper functions, triggers, stock reservation, caps, audit.

-- ============================================================================
-- Helper: check if current JWT is admin
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

CREATE OR REPLACE FUNCTION current_admin_branch_id() RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT branch_id FROM admin_users WHERE id = auth.uid();
$$;

-- ============================================================================
-- updated_at auto-maintenance
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_updated_at          BEFORE UPDATE ON orders          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_branch_stock_updated_at    BEFORE UPDATE ON branch_stock    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_site_content_updated_at    BEFORE UPDATE ON site_content    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_site_settings_updated_at   BEFORE UPDATE ON site_settings   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Order number generator: INF-YYYY-NNNN
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS order_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'INF-' || to_char(now(), 'YYYY') || '-' ||
                        lpad(nextval('order_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================================================
-- 10-book cap enforcement
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_book_cap() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_current    INTEGER;
  v_cap        INTEGER;
  v_override   INTEGER;
  v_new_qty    INTEGER;
BEGIN
  -- Skip for cancelled/completed transitions
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT student_book_cap INTO v_cap FROM site_settings WHERE id = 1;
  SELECT books_ordered_count, cap_override
    INTO v_current, v_override
    FROM students WHERE id = NEW.student_id;

  -- cap_override (if set) wins over default cap
  v_cap := COALESCE(v_override, v_cap);

  -- Sum items in this new order
  SELECT coalesce(sum(quantity), 0) INTO v_new_qty
    FROM order_items WHERE order_id = NEW.id;

  IF v_new_qty = 0 THEN
    RETURN NEW;  -- items inserted after; re-check happens on items insert
  END IF;

  IF (v_current + v_new_qty) > v_cap THEN
    RAISE EXCEPTION 'BOOK_CAP_EXCEEDED: student already has % books; cap is %', v_current, v_cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Update student's running total on order status changes
CREATE OR REPLACE FUNCTION update_student_book_count() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_items INTEGER;
BEGIN
  SELECT coalesce(sum(quantity), 0) INTO v_items
    FROM order_items WHERE order_id = NEW.id;

  -- Count when an order becomes (or stays in) an active state
  IF TG_OP = 'INSERT' AND NEW.status IN ('pending', 'confirmed', 'ready', 'completed') THEN
    UPDATE students SET books_ordered_count = books_ordered_count + v_items
      WHERE id = NEW.student_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
      UPDATE students SET books_ordered_count = GREATEST(0, books_ordered_count - v_items)
        WHERE id = NEW.student_id;
    ELSIF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
      UPDATE students SET books_ordered_count = books_ordered_count + v_items
        WHERE id = NEW.student_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_update_book_count
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION update_student_book_count();

-- ============================================================================
-- Stock soft-reservation
-- ============================================================================
-- When an order's items are created (status=pending), reserve stock in the branch.
CREATE OR REPLACE FUNCTION reserve_stock_on_item_insert() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_branch UUID;
  v_available INTEGER;
  v_hold_hours INTEGER;
BEGIN
  SELECT branch_id INTO v_branch FROM orders WHERE id = NEW.order_id;
  SELECT reservation_hold_hours INTO v_hold_hours FROM site_settings WHERE id = 1;

  SELECT (quantity - reserved_quantity) INTO v_available
    FROM branch_stock WHERE branch_id = v_branch AND book_id = NEW.book_id
    FOR UPDATE;

  IF v_available IS NULL OR v_available < NEW.quantity THEN
    RAISE EXCEPTION 'OUT_OF_STOCK: book % not available at branch % (need %, avail %)',
      NEW.book_id, v_branch, NEW.quantity, coalesce(v_available, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE branch_stock
    SET reserved_quantity = reserved_quantity + NEW.quantity
    WHERE branch_id = v_branch AND book_id = NEW.book_id;

  -- Also set the order's reservation expiry if not already set
  UPDATE orders
    SET reservation_expires_at = COALESCE(reservation_expires_at, now() + (v_hold_hours || ' hours')::interval)
    WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_items_reserve
  BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION reserve_stock_on_item_insert();

-- On order status transitions, convert reservation → deduction, or release it.
CREATE OR REPLACE FUNCTION settle_stock_on_order_status() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- confirmed/ready/completed: convert reservation → real deduction
  IF OLD.status = 'pending' AND NEW.status IN ('confirmed', 'ready', 'completed') THEN
    FOR r IN SELECT book_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
      UPDATE branch_stock
        SET quantity = quantity - r.quantity,
            reserved_quantity = reserved_quantity - r.quantity
        WHERE branch_id = NEW.branch_id AND book_id = r.book_id;
    END LOOP;

  -- cancelled from pending: release reservation
  ELSIF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    FOR r IN SELECT book_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
      UPDATE branch_stock
        SET reserved_quantity = reserved_quantity - r.quantity
        WHERE branch_id = NEW.branch_id AND book_id = r.book_id;
    END LOOP;

  -- cancelled from confirmed+: restore real stock
  ELSIF OLD.status IN ('confirmed', 'ready') AND NEW.status = 'cancelled' THEN
    FOR r IN SELECT book_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
      UPDATE branch_stock
        SET quantity = quantity + r.quantity
        WHERE branch_id = NEW.branch_id AND book_id = r.book_id;
    END LOOP;
    NEW.cancelled_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_settle_stock
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION settle_stock_on_order_status();

-- ============================================================================
-- Reservation auto-release (called by pg_cron every 5 min)
-- ============================================================================
CREATE OR REPLACE FUNCTION release_expired_reservations() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE orders
    SET status = 'cancelled',
        cancel_reason = 'reservation expired (auto-released)',
        cancelled_at = now()
    WHERE status = 'pending'
      AND reservation_expires_at IS NOT NULL
      AND reservation_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- Back-in-stock trigger — creates student notifications when stock returns
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_back_in_stock() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  w RECORD;
BEGIN
  -- Only fire when quantity goes from 0 → >0
  IF OLD.quantity = 0 AND NEW.quantity > 0 THEN
    FOR w IN
      SELECT bw.id, bw.student_id
      FROM back_in_stock_watchers bw
      WHERE bw.book_id = NEW.book_id
        AND (bw.branch_id IS NULL OR bw.branch_id = NEW.branch_id)
        AND bw.notified_at IS NULL
    LOOP
      INSERT INTO student_notifications_inbox (student_id, type, title_ar, body_ar, entity_id)
      VALUES (w.student_id, 'back_in_stock',
              'كتاب متاح الآن!',
              'الكتاب الذي كنت تنتظره عاد للمخزون.',
              NEW.book_id::text);
      UPDATE back_in_stock_watchers SET notified_at = now() WHERE id = w.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_branch_stock_back_in_stock
  AFTER UPDATE OF quantity ON branch_stock
  FOR EACH ROW EXECUTE FUNCTION notify_back_in_stock();

-- ============================================================================
-- Admin notification on new orders + low stock
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_admin_new_order() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_student_name TEXT;
BEGIN
  SELECT full_name INTO v_student_name FROM students WHERE id = NEW.student_id;
  INSERT INTO notifications (audience, type, title_ar, body_ar, entity_type, entity_id, branch_id)
  VALUES ('admin', 'new_order',
          'طلب جديد #' || NEW.order_number,
          COALESCE(v_student_name, 'طالب') || ' — ' || NEW.total || ' جنيه — ' ||
          CASE NEW.fulfillment_type WHEN 'pickup' THEN 'استلام من الفرع' ELSE 'توصيل' END,
          'order', NEW.id::text, NEW.branch_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_notify_admin
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_admin_new_order();

CREATE OR REPLACE FUNCTION notify_low_stock() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.quantity <= 3 AND OLD.quantity > 3 THEN
    SELECT title_ar INTO v_title FROM books WHERE id = NEW.book_id;
    INSERT INTO notifications (audience, type, title_ar, body_ar, entity_type, entity_id, branch_id)
    VALUES ('admin', 'low_stock',
            'تنبيه مخزون منخفض',
            'الكتاب "' || v_title || '" متبقي منه ' || NEW.quantity || ' نسخة فقط',
            'book', NEW.book_id::text, NEW.branch_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_branch_stock_low_stock
  AFTER UPDATE OF quantity ON branch_stock
  FOR EACH ROW EXECUTE FUNCTION notify_low_stock();
