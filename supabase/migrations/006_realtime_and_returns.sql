-- Phase 6 prerequisites:
-- 1. Enable Realtime replication on notification + order tables so the
--    admin bell + dashboard can subscribe to live INSERT/UPDATE events.
-- 2. Trigger to notify admin when a return is requested.

-- ============================================================================
-- Realtime publication
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE student_notifications_inbox;

-- ============================================================================
-- Return-request notification
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_admin_return_request() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_order_number TEXT;
  v_branch_id UUID;
BEGIN
  SELECT o.order_number, o.branch_id INTO v_order_number, v_branch_id
    FROM orders o WHERE o.id = NEW.order_id;
  INSERT INTO notifications (audience, type, title_ar, body_ar, entity_type, entity_id, branch_id)
  VALUES ('admin', 'return_request',
          'طلب إرجاع جديد على الطلب #' || COALESCE(v_order_number, ''),
          NEW.reason,
          'return', NEW.id::text, v_branch_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_returns_notify ON returns;
CREATE TRIGGER trg_returns_notify
  AFTER INSERT ON returns
  FOR EACH ROW EXECUTE FUNCTION notify_admin_return_request();

-- ============================================================================
-- Order-cancelled admin notification (was missing)
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_admin_order_cancelled() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO notifications (audience, type, title_ar, body_ar, entity_type, entity_id, branch_id)
    VALUES ('admin', 'order_cancelled',
            'تم إلغاء الطلب #' || NEW.order_number,
            COALESCE(NEW.cancel_reason, 'بدون سبب محدد'),
            'order', NEW.id::text, NEW.branch_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_notify_cancelled ON orders;
CREATE TRIGGER trg_orders_notify_cancelled
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_admin_order_cancelled();

-- ============================================================================
-- Student "order ready" notification
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_student_order_ready() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_branch_name TEXT;
BEGIN
  IF NEW.status = 'ready' AND OLD.status != 'ready' THEN
    SELECT name_ar INTO v_branch_name FROM branches WHERE id = NEW.branch_id;
    INSERT INTO student_notifications_inbox (student_id, type, title_ar, body_ar, entity_id)
    VALUES (NEW.student_id, 'order_ready',
            'طلبك جاهز للاستلام! 🎉',
            'الطلب #' || NEW.order_number || ' جاهز في ' || COALESCE(v_branch_name, ''),
            NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_notify_student_ready ON orders;
CREATE TRIGGER trg_orders_notify_student_ready
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_student_order_ready();
