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

-- Students (customers) — extends auth.users
CREATE TABLE students (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT,
  phone                 TEXT,
  email                 TEXT,
  grade_level           grade_level,
  governorate           TEXT,
  address               TEXT,
  books_ordered_count   INTEGER NOT NULL DEFAULT 0,
  cap_override          INTEGER,
  auth_provider         auth_provider,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
