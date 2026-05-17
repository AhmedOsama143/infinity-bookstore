-- Server-side conversion funnel log. GA4 in the browser gets blocked by
-- ad-blockers and privacy extensions at ~20-30% rates in Egypt; this table is
-- the authoritative source of truth for revenue and conversion counts.
--
-- Scope is intentionally small: only events the server can sign off on
-- (orders placed, payments confirmed). Top-of-funnel events (view_item,
-- add_to_cart) remain GA4-only because the server doesn't see them.

CREATE TABLE funnel_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name   TEXT NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  value        DECIMAL(12, 2),
  currency     TEXT NOT NULL DEFAULT 'EGP',
  props        JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_funnel_events_event_time
  ON funnel_events (event_name, occurred_at DESC);

CREATE INDEX idx_funnel_events_order
  ON funnel_events (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX idx_funnel_events_user
  ON funnel_events (user_id)
  WHERE user_id IS NOT NULL;

-- RLS: writes always go through the service-role client, so the user-facing
-- policies are read-only. Admin can see everything; everyone else sees their
-- own rows (useful if we ever surface "your activity" to a logged-in user).
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY funnel_events_admin_read ON funnel_events
  FOR SELECT USING (is_admin());

CREATE POLICY funnel_events_self_read ON funnel_events
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE funnel_events IS
  'Server-recorded conversion events. Authoritative for revenue counts; GA4 is the qualitative view but blocked too often to trust for billing/reporting.';
