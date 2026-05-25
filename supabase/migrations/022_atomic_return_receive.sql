-- 022_atomic_return_receive.sql
--
-- Replaces the JS read-modify-write loop in markReturnReceived() with a
-- single Postgres function. Two concurrent staff clicks on "received" would
-- otherwise:
--   1. both read branch_stock.quantity at value N,
--   2. both compute N + delta,
--   3. write back identical values — the second click effectively
--      restoring zero units. (TOCTOU lost-update.)
-- And the JS path had no `status` guard on the returns row, so the same
-- "received" click twice in a row would restore stock TWICE.
--
-- Fixes both: SELECT … FOR UPDATE locks the returns row, an idempotency
-- check on returns.status short-circuits the second call, and stock writes
-- use `quantity = quantity + delta` (Postgres-atomic).

CREATE OR REPLACE FUNCTION mark_return_received_atomic(p_return_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_return RECORD;
  v_branch_id UUID;
  v_item jsonb;
  v_book_id integer;
  v_qty integer;
BEGIN
  -- Row lock: blocks concurrent calls on the same return.
  SELECT id, status, order_id, items
  INTO v_return
  FROM returns
  WHERE id = p_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Idempotency: a second click is a no-op.
  IF v_return.status = 'refunded' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  -- Returns are scoped to a branch via the parent order. Look it up so the
  -- function call sites don't need to pass branch_id explicitly.
  SELECT branch_id INTO v_branch_id
  FROM orders
  WHERE id = v_return.order_id;

  IF v_branch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  -- Per-item atomic increment. Skips lines with missing/zero qty.
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(v_return.items, '[]'::jsonb))
  LOOP
    v_book_id := NULLIF(v_item->>'book_id', '')::integer;
    v_qty := NULLIF(v_item->>'quantity', '')::integer;
    IF v_book_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE branch_stock
    SET quantity = quantity + v_qty
    WHERE branch_id = v_branch_id
      AND book_id = v_book_id;
  END LOOP;

  -- Flip status last so a failure earlier doesn't leave a row marked
  -- 'refunded' with the stock un-restored. (The whole function body is one
  -- implicit transaction — any error rolls everything back.)
  UPDATE returns
  SET status = 'refunded',
      resolved_at = now()
  WHERE id = p_return_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- The TS callsite uses the service-role client, but granting `authenticated`
-- too means any future server action using the user-scoped client also works
-- without needing service-role.
GRANT EXECUTE ON FUNCTION mark_return_received_atomic(UUID) TO authenticated, service_role;
