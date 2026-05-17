import type { SupabaseClient } from '@supabase/supabase-js';

// Server-side funnel event recorder. Pair this with the GA4 client events in
// lib/analytics/gtm.ts so we have both views: GTM/GA4 for the qualitative
// funnel and this table for the unblockable ground truth.
//
// Always call with a service-role client. Failures are swallowed — analytics
// must never break the customer-facing operation that triggered the log call.

export interface FunnelEventInput {
  event: string;
  user_id?: string | null;
  order_id?: string | null;
  value?: number | null;
  currency?: string;
  props?: Record<string, unknown>;
}

export async function logFunnelEvent(
  supa: SupabaseClient,
  input: FunnelEventInput,
): Promise<void> {
  try {
    await supa.from('funnel_events').insert({
      event_name: input.event,
      user_id: input.user_id ?? null,
      order_id: input.order_id ?? null,
      value: input.value ?? null,
      currency: input.currency ?? 'EGP',
      props: input.props ?? {},
    });
  } catch {
    // Intentionally silent — see file header.
  }
}
