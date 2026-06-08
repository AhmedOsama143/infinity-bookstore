-- Infinity Bookstore — Phase 1 initial schema
-- Generated 2026-04-21. Matches §5 of PROJECT_PLAN.md.

-- ============================================================================
-- Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- Arabic-aware fuzzy search
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================================
-- Enums
-- ============================================================================
CREATE TYPE grade_level    AS ENUM ('first_secondary', 'second_secondary', 'third_secondary');
CREATE TYPE book_type      AS ENUM ('external_ar', 'online_ar');
CREATE TYPE fulfillment_type  AS ENUM ('pickup', 'delivery');
CREATE TYPE order_status   AS ENUM ('pending', 'confirmed', 'ready', 'completed', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cod', 'card', 'wallet', 'fawry', 'instapay', 'bank_transfer');
CREATE TYPE payment_provider AS ENUM ('paymob', 'fawry', 'stripe', 'manual');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_type   AS ENUM ('online', 'offline');
CREATE TYPE order_source   AS ENUM ('storefront', 'dashboard');
CREATE TYPE admin_role     AS ENUM ('admin', 'branch_manager');
CREATE TYPE auth_provider  AS ENUM ('email', 'google', 'facebook');
CREATE TYPE return_status  AS ENUM ('requested', 'approved', 'received', 'refunded', 'rejected');
CREATE TYPE notification_audience AS ENUM ('admin', 'branch_manager', 'student');
CREATE TYPE notification_type AS ENUM (
  'new_order', 'reserved', 'picked_up', 'paid', 'cod_collected',
  'low_stock', 'cap_hit', 'new_student', 'return_request', 'order_cancelled',
  'back_in_stock', 'order_ready', 'order_out_for_delivery'
);
CREATE TYPE shipping_area_type AS ENUM (
  'alexandria_city', 'alexandria_outskirts', 'kafr_el_dawwar', 'other_governorate'
);

-- ============================================================================
-- Core tables
-- ============================================================================

-- Branches (3 physical stores)
CREATE TABLE branches (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         TEXT NOT NULL UNIQUE,
  name_ar      TEXT NOT NULL,
  city         TEXT NOT NULL,
  area         TEXT,
  address_ar   TEXT NOT NULL,
  phone        TEXT NOT NULL,
  whatsapp     TEXT NOT NULL,
  latitude     DECIMAL(10, 7),
  longitude    DECIMAL(10, 7),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teachers (22 from teachers.md)
CREATE TABLE teachers (
  id            INTEGER PRIMARY KEY,          -- preserve original IDs
  name_ar       TEXT NOT NULL,
  governorate   TEXT,
  subject       TEXT,
  description   TEXT,
  photo_url     TEXT,
  facebook_url  TEXT,
  youtube_url   TEXT,
  website_url   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Books (47 from books.md)
CREATE TABLE books (
  id             INTEGER PRIMARY KEY,
  title_ar       TEXT NOT NULL,
  teacher_id     INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  grade_level    grade_level NOT NULL,
  book_type      book_type NOT NULL,
  description    TEXT,
  cover_url      TEXT,
  price          DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  discount_pct   DECIMAL(5, 2)  NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  final_price    DECIMAL(10, 2) GENERATED ALWAYS AS (ROUND(price * (1 - discount_pct / 100), 2)) STORED,
  weight_grams   INTEGER,
  publish_year   INTEGER,
  isbn           TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  needs_review   BOOLEAN NOT NULL DEFAULT false,  -- set when seeded stock was negative
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_books_teacher    ON books(teacher_id);
CREATE INDEX idx_books_grade      ON books(grade_level);
CREATE INDEX idx_books_active     ON books(is_active) WHERE is_active;
CREATE INDEX idx_books_title_trgm ON books USING gin (title_ar gin_trgm_ops);

-- Per-branch inventory
CREATE TABLE branch_stock (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id          UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  book_id            INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quantity           INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, book_id),
  CHECK (reserved_quantity <= quantity)
);
CREATE INDEX idx_branch_stock_book   ON branch_stock(book_id);
CREATE INDEX idx_branch_stock_branch ON branch_stock(branch_id);

-- Students (customers). Registered users get id = auth.users.id via handle_new_user;
-- guests (dashboard manual entry walk-ins) get a fresh UUID and is_guest=true.
CREATE TABLE students (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name             TEXT,
  phone                 TEXT,
  email                 TEXT,
  grade_level           grade_level,
  governorate           TEXT,
  address               TEXT,
  books_ordered_count   INTEGER NOT NULL DEFAULT 0,
  cap_override          INTEGER,
  auth_provider         auth_provider,
  is_guest              BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_phone ON students(phone) WHERE phone IS NOT NULL;

-- Admin users (owner + branch managers)
CREATE TABLE admin_users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         admin_role NOT NULL,
  branch_id    UUID REFERENCES branches(id) ON DELETE SET NULL,
  mfa_enabled  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- branch managers must be tied to a branch; admins may not be
  CHECK (
    (role = 'admin' AND branch_id IS NULL)
    OR (role = 'branch_manager' AND branch_id IS NOT NULL)
  )
);

-- Orders
CREATE TABLE orders (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number            TEXT NOT NULL UNIQUE,
  student_id              UUID NOT NULL REFERENCES students(id),
  branch_id               UUID NOT NULL REFERENCES branches(id),
  fulfillment_type        fulfillment_type NOT NULL,
  status                  order_status NOT NULL DEFAULT 'pending',
  shipping_governorate    TEXT,
  shipping_address        TEXT,
  shipping_fee            DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  subtotal                DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  total                   DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  payment_status          payment_status NOT NULL DEFAULT 'pending',
  payment_method          payment_method NOT NULL DEFAULT 'cod',
  payment_type            payment_type NOT NULL,
  order_source            order_source NOT NULL DEFAULT 'storefront',
  reservation_expires_at  TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  cancelled_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason           TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_student ON orders(student_id);
CREATE INDEX idx_orders_branch  ON orders(branch_id);
CREATE INDEX idx_orders_status  ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_payment_type ON orders(payment_type);
CREATE INDEX idx_orders_order_source ON orders(order_source);
CREATE INDEX idx_orders_pending_reservation ON orders(reservation_expires_at) WHERE status = 'pending';

-- Order items
CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal    DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_book  ON order_items(book_id);

-- Payments
CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method           payment_method NOT NULL,
  provider         payment_provider,
  amount           DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  currency         TEXT NOT NULL DEFAULT 'EGP',
  status           payment_status NOT NULL DEFAULT 'pending',
  transaction_ref  TEXT,
  gateway_fee      DECIMAL(10, 2) DEFAULT 0,
  net_amount       DECIMAL(10, 2),
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order ON payments(order_id);

-- Returns
CREATE TABLE returns (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       UUID NOT NULL REFERENCES orders(id),
  items          JSONB NOT NULL,
  reason         TEXT NOT NULL,
  status         return_status NOT NULL DEFAULT 'requested',
  refund_amount  DECIMAL(10, 2),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ
);
CREATE INDEX idx_returns_order ON returns(order_id);

-- Admin & branch-manager notifications
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audience      notification_audience NOT NULL,
  recipient_id  UUID,
  type          notification_type NOT NULL,
  title_ar      TEXT NOT NULL,
  body_ar       TEXT,
  entity_type   TEXT,
  entity_id     TEXT,
  branch_id     UUID REFERENCES branches(id),
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_audience  ON notifications(audience, is_read);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id) WHERE recipient_id IS NOT NULL;
CREATE INDEX idx_notifications_created   ON notifications(created_at DESC);

-- Student-side notifications inbox
CREATE TABLE student_notifications_inbox (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title_ar    TEXT NOT NULL,
  body_ar     TEXT,
  entity_id   TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_notifs_student ON student_notifications_inbox(student_id, is_read);

-- Back-in-stock watchers
CREATE TABLE back_in_stock_watchers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  book_id      INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,  -- NULL = any branch
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, book_id, branch_id)
);

-- Abandoned carts
CREATE TABLE abandoned_carts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  items             JSONB NOT NULL,
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_4h_sent     BOOLEAN NOT NULL DEFAULT false,
  email_24h_sent    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (student_id)
);

-- Wishlists
CREATE TABLE wishlists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, book_id)
);

-- Shipping rates
CREATE TABLE shipping_rates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  governorate_ar  TEXT NOT NULL,
  area_type       shipping_area_type NOT NULL,
  price           DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (governorate_ar, area_type)
);

-- Book bundles (schema v1, UI later)
CREATE TABLE book_bundles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title_ar      TEXT NOT NULL,
  description   TEXT,
  price         DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  discount_pct  DECIMAL(5, 2) NOT NULL DEFAULT 0,
  final_price   DECIMAL(10, 2) GENERATED ALWAYS AS (ROUND(price * (1 - discount_pct / 100), 2)) STORED,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bundle_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_id  UUID NOT NULL REFERENCES book_bundles(id) ON DELETE CASCADE,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

-- Promo codes (later)
CREATE TABLE promo_codes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  discount_value  DECIMAL(10, 2) NOT NULL,
  valid_from      TIMESTAMPTZ,
  valid_to        TIMESTAMPTZ,
  usage_limit     INTEGER,
  times_used      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID,
  actor_role   TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT,
  diff         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor  ON audit_log(actor_id);

-- Editable content (About, FAQ, banners, legal pages)
CREATE TABLE site_content (
  key         TEXT PRIMARY KEY,
  title_ar    TEXT,
  body_ar     TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Singleton settings row
CREATE TABLE site_settings (
  id                        INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  free_shipping_threshold   DECIMAL(10, 2) NOT NULL DEFAULT 2500,
  free_shipping_enabled     BOOLEAN NOT NULL DEFAULT true,
  announcement_bar_text_ar  TEXT DEFAULT '🚚 شحن مجاني لكل طلب أكثر من ٢٥٠٠ جنيه — على جميع المحافظات!',
  announcement_bar_enabled  BOOLEAN NOT NULL DEFAULT true,
  student_book_cap          INTEGER NOT NULL DEFAULT 10,
  abandoned_cart_enabled    BOOLEAN NOT NULL DEFAULT true,
  reservation_hold_hours    INTEGER NOT NULL DEFAULT 24,
  support_phone             TEXT DEFAULT '01104605272',
  support_whatsapp          TEXT DEFAULT '201104605272',
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
-- Row Level Security policies for every user-facing table.
-- Roles: anon (public), authenticated (student), admin (via app_metadata), branch_manager.

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================
ALTER TABLE branches                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE books                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_stock                ENABLE ROW LEVEL SECURITY;
ALTER TABLE students                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications               ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_notifications_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE back_in_stock_watchers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned_carts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_rates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_bundles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content                ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings               ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Public read (anon + authenticated)
-- ============================================================================
CREATE POLICY "public read active branches" ON branches
  FOR SELECT USING (is_active);

CREATE POLICY "public read active teachers" ON teachers
  FOR SELECT USING (is_active);

CREATE POLICY "public read active books" ON books
  FOR SELECT USING (is_active);

CREATE POLICY "public read branch stock" ON branch_stock
  FOR SELECT USING (true);

CREATE POLICY "public read shipping rates" ON shipping_rates
  FOR SELECT USING (is_active);

CREATE POLICY "public read site content" ON site_content
  FOR SELECT USING (true);

CREATE POLICY "public read site settings" ON site_settings
  FOR SELECT USING (true);

CREATE POLICY "public read active bundles" ON book_bundles
  FOR SELECT USING (is_active);

CREATE POLICY "public read bundle items" ON bundle_items
  FOR SELECT USING (true);

-- ============================================================================
-- Students — full control over their own row only
-- ============================================================================
CREATE POLICY "student read self" ON students
  FOR SELECT USING (auth.uid() = id OR is_admin());

CREATE POLICY "student insert self" ON students
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "student update self" ON students
  FOR UPDATE USING (auth.uid() = id OR is_admin())
  WITH CHECK (auth.uid() = id OR is_admin());

-- ============================================================================
-- Admin users — admin-only
-- ============================================================================
CREATE POLICY "admin manage admin_users" ON admin_users
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_user read own row" ON admin_users
  FOR SELECT USING (auth.uid() = id);

-- ============================================================================
-- Orders — students see own; admin sees all; branch mgr sees own branch
-- ============================================================================
CREATE POLICY "student read own orders" ON orders
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "student create own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "student cancel own pending orders" ON orders
  FOR UPDATE USING (
    auth.uid() = student_id
    AND status = 'pending'
    AND created_at > now() - interval '1 hour'
  ) WITH CHECK (status = 'cancelled');

CREATE POLICY "admin all orders" ON orders
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "branch mgr read branch orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND role = 'branch_manager' AND branch_id = orders.branch_id
    )
  );

CREATE POLICY "branch mgr mark picked up" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND role = 'branch_manager' AND branch_id = orders.branch_id
    )
  ) WITH CHECK (status IN ('ready', 'completed'));

-- ============================================================================
-- Order items — same visibility as the parent order
-- ============================================================================
CREATE POLICY "order items parent visible" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = order_items.order_id
      AND (o.student_id = auth.uid() OR is_admin())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = order_items.order_id
      AND o.student_id = auth.uid()
    )
  );

-- ============================================================================
-- Payments — students read their own, admin full
-- ============================================================================
CREATE POLICY "student read own payments" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE id = payments.order_id AND student_id = auth.uid())
  );

CREATE POLICY "admin all payments" ON payments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================================
-- Returns
-- ============================================================================
CREATE POLICY "student read own returns" ON returns
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE id = returns.order_id AND student_id = auth.uid())
  );

CREATE POLICY "student create return for own order" ON returns
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE id = returns.order_id AND student_id = auth.uid())
  );

CREATE POLICY "admin all returns" ON returns
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================================
-- Notifications — admin inbox
-- ============================================================================
CREATE POLICY "admin read all notifications" ON notifications
  FOR SELECT USING (is_admin());

CREATE POLICY "branch mgr read branch notifications" ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND role = 'branch_manager' AND branch_id = notifications.branch_id
    )
  );

CREATE POLICY "admin update notifications" ON notifications
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- Inserts come from triggers (security definer), no policy needed for INSERT.

-- ============================================================================
-- Student notifications inbox
-- ============================================================================
CREATE POLICY "student read own inbox" ON student_notifications_inbox
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "student update own inbox" ON student_notifications_inbox
  FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- ============================================================================
-- Watchers, abandoned carts, wishlists — student-owned
-- ============================================================================
CREATE POLICY "student manage own watchers" ON back_in_stock_watchers
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE POLICY "student manage own abandoned" ON abandoned_carts
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE POLICY "student manage own wishlist" ON wishlists
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- ============================================================================
-- Admin-only write tables
-- ============================================================================
CREATE POLICY "admin manage branches"       ON branches       FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage teachers"       ON teachers       FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage books"          ON books          FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage branch stock"   ON branch_stock   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage shipping rates" ON shipping_rates FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage bundles"        ON book_bundles   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage bundle items"   ON bundle_items   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage promo codes"    ON promo_codes    FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage site content"   ON site_content   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage site settings"  ON site_settings  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin read audit log"        ON audit_log      FOR SELECT USING (is_admin());

-- Branch manager read-only on branch_stock for their branch
CREATE POLICY "branch mgr read own branch stock" ON branch_stock
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND role = 'branch_manager' AND admin_users.branch_id = branch_stock.branch_id
    )
  );
-- Static seed data: branches, shipping rates, site settings, admin mapping.
-- Teacher/book data is seeded by scripts/seed.ts (needs .md parsing + image upload).

-- ============================================================================
-- Site settings singleton
-- ============================================================================
INSERT INTO site_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Branches (3)
-- ============================================================================
INSERT INTO branches (slug, name_ar, city, area, address_ar, phone, whatsapp, latitude, longitude, sort_order) VALUES
  ('tamlik',  'فرع التمليك',     'كفر الدوار',  'التمليك',       'البحيرة — كفر الدوار — التمليك — أمام مسجد الهدي',                            '+201203417049', '201203417049', 31.1489677, 30.1269855, 1),
  ('elgeish', 'فرع شارع الجيش',  'كفر الدوار',  'شارع الجيش',    'البحيرة — كفر الدوار — شارع الجيش — خلف بنك مصر، أمام مول الأصدقاء',        '+201558656542', '201558656542', 31.1324539, 30.1351109, 2),
  ('escott',  'فرع سيدي بشر',    'الإسكندرية',  'سيدي بشر بحري', 'الإسكندرية — سيدي بشر بحري — شارع 17 — فوق النفق (منطقة سيدي بشر)',              '+201553950043', '201553950043', 31.2599754, 29.9891243, 3)
ON CONFLICT (slug) DO UPDATE SET
  name_ar    = EXCLUDED.name_ar,
  address_ar = EXCLUDED.address_ar,
  phone      = EXCLUDED.phone,
  whatsapp   = EXCLUDED.whatsapp,
  latitude   = EXCLUDED.latitude,
  longitude  = EXCLUDED.longitude;

-- ============================================================================
-- Shipping rates (Alex 60, Alex outskirts 80, Kafr El-Dawwar 30; others TBD)
-- ============================================================================
INSERT INTO shipping_rates (governorate_ar, area_type, price) VALUES
  ('الإسكندرية',  'alexandria_city',       60.00),
  ('الإسكندرية',  'alexandria_outskirts',  80.00),
  ('البحيرة',     'kafr_el_dawwar',        30.00)
ON CONFLICT (governorate_ar, area_type) DO UPDATE SET price = EXCLUDED.price;

-- ============================================================================
-- Link existing admin auth user to admin_users table
-- ============================================================================
INSERT INTO admin_users (id, role, branch_id, mfa_enabled)
SELECT id, 'admin'::admin_role, NULL, false
  FROM auth.users
  WHERE email = 'ammar@infinty.admin'
ON CONFLICT (id) DO UPDATE SET role = 'admin', branch_id = NULL;

-- Mirror app_metadata.role for the JWT-based is_admin() check
UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'admin')
  WHERE email = 'ammar@infinty.admin';

-- ============================================================================
-- Default site content (editable later from admin)
-- ============================================================================
INSERT INTO site_content (key, title_ar, body_ar) VALUES
  ('about',   'من نحن',
   E'مركز إنفينيتي مركز متخصص في كتب المدرسين للمرحلة الثانوية.\nنخدم طلاب كفر الدوار والإسكندرية من ٣ فروع، مع التوصيل لكافة المحافظات.'),
  ('faq',     'الأسئلة الشائعة', E'سيتم إضافة الأسئلة قريبًا.'),
  ('privacy', 'سياسة الخصوصية', E'سيتم إضافة سياسة الخصوصية قريبًا.'),
  ('terms',   'شروط الاستخدام', E'سيتم إضافة شروط الاستخدام قريبًا.'),
  ('refund',  'سياسة الاسترجاع', E'سيتم إضافة سياسة الاسترجاع قريبًا.'),
  ('shipping_policy', 'سياسة الشحن', E'شحن مجاني للطلبات فوق ٢٥٠٠ جنيه. الإسكندرية ٦٠ جنيه — ضواحي الإسكندرية ٨٠ جنيه — كفر الدوار ٣٠ جنيه.')
ON CONFLICT (key) DO NOTHING;
