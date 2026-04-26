-- Phase 7: reviews, stock transfers, promo redemption helper.

-- ============================================================================
-- Reviews & ratings (book-level)
-- ============================================================================
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id      INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,    -- proves purchase
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title_ar     TEXT,
  body_ar      TEXT,
  status       review_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ,
  UNIQUE (book_id, student_id)
);
CREATE INDEX idx_reviews_book ON reviews(book_id) WHERE status = 'approved';
CREATE INDEX idx_reviews_pending ON reviews(status) WHERE status = 'pending';

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read approved reviews" ON reviews
  FOR SELECT USING (status = 'approved' OR student_id = auth.uid() OR is_admin());

CREATE POLICY "student create own review" ON reviews
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND o.student_id = auth.uid()
        AND o.status = 'completed'
    )
  );

CREATE POLICY "student update own pending review" ON reviews
  FOR UPDATE USING (student_id = auth.uid() AND status = 'pending')
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "admin manage reviews" ON reviews
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Notify admin on new review
CREATE OR REPLACE FUNCTION notify_admin_new_review() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_book_title TEXT;
BEGIN
  SELECT title_ar INTO v_book_title FROM books WHERE id = NEW.book_id;
  INSERT INTO notifications (audience, type, title_ar, body_ar, entity_type, entity_id)
  VALUES ('admin', 'new_student',  -- reuse 'new_student' enum slot for now
          'مراجعة جديدة على "' || COALESCE(v_book_title, '') || '"',
          'تقييم: ' || NEW.rating || '/5',
          'review', NEW.id::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_notify ON reviews;
CREATE TRIGGER trg_reviews_notify
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION notify_admin_new_review();

-- ============================================================================
-- Stock transfers between branches
-- ============================================================================
CREATE TYPE transfer_status AS ENUM ('pending', 'completed', 'cancelled');

CREATE TABLE stock_transfers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_branch   UUID NOT NULL REFERENCES branches(id),
  to_branch     UUID NOT NULL REFERENCES branches(id),
  book_id       INTEGER NOT NULL REFERENCES books(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  status        transfer_status NOT NULL DEFAULT 'pending',
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  CHECK (from_branch != to_branch)
);
CREATE INDEX idx_transfers_status ON stock_transfers(status);
CREATE INDEX idx_transfers_created ON stock_transfers(created_at DESC);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage transfers" ON stock_transfers
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "branch mgr read own transfers" ON stock_transfers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.role = 'branch_manager'
        AND (au.branch_id = stock_transfers.from_branch OR au.branch_id = stock_transfers.to_branch)
    )
  );

-- Atomic transfer execution: deduct from source, add to destination.
CREATE OR REPLACE FUNCTION execute_stock_transfer(p_transfer_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_t RECORD;
  v_avail INTEGER;
BEGIN
  SELECT * INTO v_t FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF v_t IS NULL THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;
  IF v_t.status != 'pending' THEN
    RAISE EXCEPTION 'Transfer not pending (status=%)', v_t.status;
  END IF;

  SELECT (quantity - reserved_quantity) INTO v_avail
    FROM branch_stock
    WHERE branch_id = v_t.from_branch AND book_id = v_t.book_id
    FOR UPDATE;
  IF COALESCE(v_avail, 0) < v_t.quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: branch has % available, needs %', COALESCE(v_avail, 0), v_t.quantity;
  END IF;

  -- Deduct from source
  UPDATE branch_stock
    SET quantity = quantity - v_t.quantity
    WHERE branch_id = v_t.from_branch AND book_id = v_t.book_id;

  -- Add to destination (insert row if missing)
  INSERT INTO branch_stock (branch_id, book_id, quantity)
    VALUES (v_t.to_branch, v_t.book_id, v_t.quantity)
    ON CONFLICT (branch_id, book_id)
    DO UPDATE SET quantity = branch_stock.quantity + EXCLUDED.quantity;

  UPDATE stock_transfers
    SET status = 'completed', completed_at = now()
    WHERE id = p_transfer_id;
END;
$$;

-- ============================================================================
-- Promo code validation helper (used at checkout)
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_promo_code(p_code TEXT)
RETURNS TABLE (
  valid           BOOLEAN,
  reason          TEXT,
  discount_type   TEXT,
  discount_value  DECIMAL,
  promo_id        UUID
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_promo FROM promo_codes WHERE LOWER(code) = LOWER(p_code) LIMIT 1;
  IF v_promo IS NULL THEN
    RETURN QUERY SELECT false, 'كود غير صحيح', NULL::TEXT, NULL::DECIMAL, NULL::UUID;
    RETURN;
  END IF;
  IF NOT v_promo.is_active THEN
    RETURN QUERY SELECT false, 'كود غير مفعّل', NULL::TEXT, NULL::DECIMAL, NULL::UUID;
    RETURN;
  END IF;
  IF v_promo.valid_from IS NOT NULL AND now() < v_promo.valid_from THEN
    RETURN QUERY SELECT false, 'كود لم يبدأ بعد', NULL::TEXT, NULL::DECIMAL, NULL::UUID;
    RETURN;
  END IF;
  IF v_promo.valid_to IS NOT NULL AND now() > v_promo.valid_to THEN
    RETURN QUERY SELECT false, 'كود منتهي الصلاحية', NULL::TEXT, NULL::DECIMAL, NULL::UUID;
    RETURN;
  END IF;
  IF v_promo.usage_limit IS NOT NULL AND v_promo.times_used >= v_promo.usage_limit THEN
    RETURN QUERY SELECT false, 'كود مستخدم بالكامل', NULL::TEXT, NULL::DECIMAL, NULL::UUID;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, NULL::TEXT, v_promo.discount_type, v_promo.discount_value, v_promo.id;
END;
$$;
