-- Phase D — Stock Integrity Agent: atomic cart hold claim.
--
-- Phase C used "read availability → decide → fire-and-forget upsert," which
-- has a small race window where two simultaneous add-to-cart calls can both
-- read the same `available_for_other_carts` and both succeed in granting.
-- This migration collapses the read + write into one SQL function guarded by
-- a per-book advisory lock so concurrent claims serialize.
--
-- Returns the integer quantity actually granted (clamped at 0). The caller
-- treats this as the authoritative new cart-line + hold quantity.
--
-- Behavior:
--   • If requested_qty <= 0 → drop any existing hold, return 0.
--   • Otherwise lock on the book, recompute availability excluding the user's
--     own hold, grant min(requested, available_to_me), and upsert the hold.
--
-- The function does NOT refuse when the user already has more held than
-- requested — it simply updates the hold to the requested quantity (allowing
-- decrements to shrink the hold immediately when callers route through it).

CREATE OR REPLACE FUNCTION public.try_acquire_cart_hold(
  p_book_id INTEGER,
  p_user_id UUID,
  p_requested_qty INTEGER,
  p_hold_minutes INTEGER DEFAULT 15
) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_stock          INTEGER;
  v_others_holds   INTEGER;
  v_max_grantable  INTEGER;
  v_granted        INTEGER;
  v_expires        TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'try_acquire_cart_hold requires a user_id (guests not supported)';
  END IF;

  -- Drop on non-positive requests, no lock needed.
  IF p_requested_qty IS NULL OR p_requested_qty <= 0 THEN
    DELETE FROM cart_holds WHERE user_id = p_user_id AND book_id = p_book_id;
    RETURN 0;
  END IF;

  -- Serialize concurrent claims for the same book. Per-book lock keeps
  -- contention scoped — different books proceed in parallel.
  PERFORM pg_advisory_xact_lock(hashtext('cart_hold:' || p_book_id::text)::bigint);

  SELECT COALESCE(SUM(bs.quantity - bs.reserved_quantity), 0)
    INTO v_stock
    FROM branch_stock bs
    JOIN branches b ON b.id = bs.branch_id
    WHERE bs.book_id = p_book_id AND b.is_active;

  SELECT COALESCE(SUM(quantity), 0)
    INTO v_others_holds
    FROM cart_holds
    WHERE book_id = p_book_id
      AND expires_at > NOW()
      AND user_id <> p_user_id;

  v_max_grantable := GREATEST(0, v_stock - v_others_holds);
  v_granted := LEAST(p_requested_qty, v_max_grantable);

  IF v_granted > 0 THEN
    v_expires := NOW() + (p_hold_minutes || ' minutes')::interval;
    INSERT INTO cart_holds (user_id, book_id, quantity, expires_at, updated_at)
      VALUES (p_user_id, p_book_id, v_granted, v_expires, NOW())
      ON CONFLICT (user_id, book_id) DO UPDATE
        SET quantity   = EXCLUDED.quantity,
            expires_at = EXCLUDED.expires_at,
            updated_at = EXCLUDED.updated_at;
  ELSE
    DELETE FROM cart_holds WHERE user_id = p_user_id AND book_id = p_book_id;
  END IF;

  RETURN v_granted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_acquire_cart_hold(INTEGER, UUID, INTEGER, INTEGER)
  TO authenticated, service_role;
