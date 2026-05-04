-- Phase C — Stock Integrity Agent: cart soft-holds.
--
-- Each row is a "this customer currently has N copies of this book parked in
-- their cart" reservation. The hold:
--   • subtracts from the *aggregate* available stock as seen by *other* users
--   • is owner-scoped — the holder always sees their own units as available
--   • auto-expires after `hold_minutes` of inactivity (default 15 min)
--   • is dropped on cart removal, cart clear, and on placeOrder success
--     (the order's reserved_quantity supersedes once placed)
--
-- Guests are intentionally NOT supported in this MVP. Holds require a stable
-- identity; introducing a cookie surface, RLS, and login-time migration is its
-- own project. Guests can still browse and add to cart locally — they just
-- don't reduce other customers' availability until they sign in.
--
-- Per-branch availability checks at checkout are unchanged. Holds only affect
-- the cart-level "can I add this to my cart?" decision; the trigger in 015
-- still owns the per-branch reservation/settlement story.

CREATE TABLE IF NOT EXISTS cart_holds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_holds_book_expiry ON cart_holds(book_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_cart_holds_user ON cart_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_holds_expiry ON cart_holds(expires_at);

ALTER TABLE cart_holds ENABLE ROW LEVEL SECURITY;
-- No public policies. The Stock Integrity module always uses the service-role
-- client for cart_holds; nothing in the app needs RLS-scoped access here.

-- =============================================================================
-- available_for_other_carts(book_id, viewer_user_id)
--
-- Returns aggregate available stock (across active branches) for a book,
-- after subtracting the quantity reserved in *other* customers' active carts.
-- The viewer's own hold is excluded so they always see their own units.
-- viewer_user_id may be NULL (guest) — no holds excluded.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.available_for_other_carts(
  p_book_id INTEGER,
  p_viewer_user_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_stock INTEGER;
  v_holds INTEGER;
BEGIN
  SELECT COALESCE(SUM(bs.quantity - bs.reserved_quantity), 0)
    INTO v_stock
    FROM branch_stock bs
    JOIN branches b ON b.id = bs.branch_id
    WHERE bs.book_id = p_book_id AND b.is_active;

  SELECT COALESCE(SUM(quantity), 0)
    INTO v_holds
    FROM cart_holds
    WHERE book_id = p_book_id
      AND expires_at > NOW()
      AND (p_viewer_user_id IS NULL OR user_id <> p_viewer_user_id);

  RETURN GREATEST(0, v_stock - v_holds);
END;
$$;

GRANT EXECUTE ON FUNCTION public.available_for_other_carts(INTEGER, UUID) TO authenticated, anon, service_role;

-- =============================================================================
-- Hold expiry — pg_cron every 5 minutes.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.release_expired_cart_holds() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH del AS (
    DELETE FROM cart_holds WHERE expires_at <= NOW() RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_expired_cart_holds() TO service_role;

-- Schedule the cleanup if pg_cron is available. On Supabase free tier the
-- extension must be enabled via the dashboard; if it's not there, this
-- migration still installs the table + functions and the user can wire up
-- the schedule (or call release_expired_cart_holds() from any other timer)
-- whenever pg_cron becomes available.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'release-expired-cart-holds',
      '*/5 * * * *',
      $job$ SELECT release_expired_cart_holds(); $job$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — release_expired_cart_holds() will not auto-run; enable pg_cron in the Supabase dashboard then re-schedule.';
  END IF;
END
$do$;
