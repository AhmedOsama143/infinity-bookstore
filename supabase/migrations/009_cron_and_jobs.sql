-- Scheduled jobs and helper functions for:
--   1. Reservation auto-release (every 5 min)
--   2. Abandoned cart marker (every 30 min — creates inbox entries)
--   3. Low-stock daily digest (once a day at 09:00 Africa/Cairo)
--
-- Uses pg_cron + the existing release_expired_reservations() function.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- 1. Reservation auto-release — runs every 5 minutes
-- =============================================================================
SELECT cron.schedule(
  'release-expired-reservations',
  '*/5 * * * *',
  $$ SELECT release_expired_reservations(); $$
);

-- =============================================================================
-- 2. Abandoned cart marker
--
--    A "cart" here is the abandoned_carts table (which is populated client-side
--    when items linger without checkout). This function fires reminder
--    notifications at the 4h and 24h marks. Email delivery happens out-of-band
--    from the Next.js server when the inbox entry is created.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_abandoned_carts() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER := 0;
  c RECORD;
BEGIN
  -- 4-hour reminder (only once per cart)
  FOR c IN
    SELECT id, student_id FROM abandoned_carts
    WHERE last_activity_at < now() - interval '4 hours'
      AND last_activity_at > now() - interval '24 hours'
      AND email_4h_sent = false
  LOOP
    INSERT INTO student_notifications_inbox (student_id, type, title_ar, body_ar)
    VALUES (c.student_id, 'abandoned_cart_4h',
            'كتبك تنتظرك في السلة',
            'لا تنسَ إكمال طلبك — احصل على شحن مجاني للطلبات فوق ٢٥٠٠ جنيه.');
    UPDATE abandoned_carts SET email_4h_sent = true WHERE id = c.id;
    v_count := v_count + 1;
  END LOOP;

  -- 24-hour reminder (only once per cart)
  FOR c IN
    SELECT id, student_id FROM abandoned_carts
    WHERE last_activity_at < now() - interval '24 hours'
      AND last_activity_at > now() - interval '7 days'
      AND email_24h_sent = false
  LOOP
    INSERT INTO student_notifications_inbox (student_id, type, title_ar, body_ar)
    VALUES (c.student_id, 'abandoned_cart_24h',
            'سلة كتبك ما زالت في انتظارك',
            'أكمل طلبك قبل أن تنفد الكميات من فروعنا.');
    UPDATE abandoned_carts SET email_24h_sent = true WHERE id = c.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

SELECT cron.schedule(
  'process-abandoned-carts',
  '*/30 * * * *',
  $$ SELECT process_abandoned_carts(); $$
);

-- =============================================================================
-- 3. Low-stock daily digest
--
--    At 09:00 Africa/Cairo (07:00 UTC), inserts a single admin notification
--    summarizing books at qty ≤ 3 across any branch.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.low_stock_digest() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
  v_body TEXT;
BEGIN
  SELECT count(*) INTO v_count
  FROM branch_stock bs
  WHERE (bs.quantity - bs.reserved_quantity) <= 3;

  IF v_count = 0 THEN
    RETURN 0;
  END IF;

  SELECT string_agg(
    b.title_ar || ' (' || br.name_ar || ': ' || (bs.quantity - bs.reserved_quantity) || ')',
    E'\n'
  )
  INTO v_body
  FROM branch_stock bs
  JOIN books b ON b.id = bs.book_id
  JOIN branches br ON br.id = bs.branch_id
  WHERE (bs.quantity - bs.reserved_quantity) <= 3
  ORDER BY (bs.quantity - bs.reserved_quantity) ASC
  LIMIT 20;

  INSERT INTO notifications (audience, type, title_ar, body_ar)
  VALUES ('admin', 'low_stock',
          'تنبيه مخزون منخفض: ' || v_count || ' عنصر',
          v_body);

  RETURN v_count;
END;
$$;

SELECT cron.schedule(
  'low-stock-daily-digest',
  '0 7 * * *',
  $$ SELECT low_stock_digest(); $$
);

-- =============================================================================
-- 4. Inbox entry on order status changes (already covered by triggers in 002,
--    but we add explicit student-inbox copies for the friendlier UX).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.on_order_status_inbox() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN
      v_title := 'تم تأكيد طلبك ' || NEW.order_number;
      v_body  := 'سيتم تجهيز طلبك في الفرع. سنخبرك عند جاهزيته للاستلام.';
    WHEN 'ready' THEN
      v_title := 'طلبك جاهز للاستلام';
      v_body  := 'يمكنك المرور على الفرع لاستلام الطلب.';
    WHEN 'completed' THEN
      v_title := 'تم استلام الطلب';
      v_body  := 'شكرًا لتسوقك من إنفينيتي 🌿';
    WHEN 'cancelled' THEN
      v_title := 'تم إلغاء الطلب ' || NEW.order_number;
      v_body  := COALESCE(NEW.cancel_reason, 'تم إلغاء الطلب — تواصل معنا لمزيد من التفاصيل.');
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO student_notifications_inbox (student_id, type, title_ar, body_ar, entity_id)
  VALUES (NEW.student_id, 'order_' || NEW.status, v_title, v_body, NEW.id::text);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_status_inbox ON orders;
CREATE TRIGGER trg_orders_status_inbox
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION on_order_status_inbox();

GRANT EXECUTE ON FUNCTION public.process_abandoned_carts() TO service_role;
GRANT EXECUTE ON FUNCTION public.low_stock_digest() TO service_role;
