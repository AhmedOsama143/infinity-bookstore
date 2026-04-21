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
