-- Stock Integrity Agent — decision audit log.
-- Every customer/staff stock decision (block, adjust, warn_and_allow, allow) is
-- recorded here so we can reconcile, investigate fraud, and forecast procurement.

CREATE TABLE IF NOT EXISTS stock_decisions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type       TEXT NOT NULL CHECK (actor_type IN ('customer','staff')),
  actor_id         UUID,                       -- auth.users.id; null for guests
  touchpoint       TEXT NOT NULL,              -- product_detail, book_card, cart_increment, cart_revalidate, manual_order, etc.
  action           TEXT NOT NULL,              -- add, increment, set_quantity, revalidate
  book_id          INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,
  requested_qty    INTEGER NOT NULL,
  current_in_cart  INTEGER NOT NULL DEFAULT 0,
  effective_qty    INTEGER NOT NULL,
  available_stock  INTEGER NOT NULL,
  final_qty        INTEGER NOT NULL,
  decision         TEXT NOT NULL CHECK (decision IN ('allow','block','adjust','warn_and_allow')),
  flags            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  user_message     TEXT,
  note             TEXT                        -- staff-entered note on overrides
);

CREATE INDEX IF NOT EXISTS idx_stock_decisions_book ON stock_decisions(book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_decisions_actor ON stock_decisions(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_decisions_decision ON stock_decisions(decision, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_decisions_oversold
  ON stock_decisions(created_at DESC)
  WHERE 'oversold' = ANY(flags);

ALTER TABLE stock_decisions ENABLE ROW LEVEL SECURITY;

-- Read: admins only (procurement/fraud reconciliation surface).
DROP POLICY IF EXISTS stock_decisions_admin_read ON stock_decisions;
CREATE POLICY stock_decisions_admin_read ON stock_decisions
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

-- Insert: open. Server actions write here on behalf of customers (incl. guests)
-- and staff alike. The app code is the single writer; nothing here is sensitive.
DROP POLICY IF EXISTS stock_decisions_open_insert ON stock_decisions;
CREATE POLICY stock_decisions_open_insert ON stock_decisions
  FOR INSERT
  WITH CHECK (true);
