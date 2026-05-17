'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reconcileOrderWithFawry } from '@/lib/fawry/reconcile';

// Lightweight read used by the result page's client-side poller. Returns the
// current payment status under RLS, so a logged-out or wrong-user request
// returns null — same protection as the page itself.
//
// Stays narrow on purpose: only the fields the client component renders, no
// nested joins, no items. Each poll is one indexed lookup.

export interface OrderStatusSnapshot {
  payment_status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  status: string;
  payment_method_detail: string | null;
  fawry_ref_number: string | null;
  payment_paid_at: string | null;
  payment_expires_at: string | null;
}

export async function getOrderPaymentStatus(
  orderId: string,
): Promise<OrderStatusSnapshot | null> {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return null;

  const { data } = await supa
    .from('orders')
    .select(
      'payment_status, status, payment_method_detail, fawry_ref_number, payment_paid_at, payment_expires_at',
    )
    .eq('id', orderId)
    .eq('student_id', user.id)
    .maybeSingle();

  return (data as OrderStatusSnapshot | null) ?? null;
}

/**
 * Server-to-Fawry status reconciliation. Triggers a Fawry status poll for the
 * given order's merchant reference and applies any state transition our DB is
 * missing. Used by the result page when the in-app poll loop times out
 * (typical for wallet pushes where the webhook lags the redirect).
 *
 * Returns the latest snapshot after reconciliation, or null on auth/error.
 */
export async function reconcileWithFawry(
  orderId: string,
): Promise<OrderStatusSnapshot | null> {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select(
      'id, merchant_ref_number, status, payment_status, payment_method, payment_method_detail, fawry_ref_number, total',
    )
    .eq('id', orderId)
    .eq('student_id', user.id)
    .maybeSingle();
  if (!order || order.payment_method !== 'fawry') return getOrderPaymentStatus(orderId);

  await reconcileOrderWithFawry(admin, order.merchant_ref_number ?? order.id, {
    id: order.id,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    payment_method_detail: order.payment_method_detail,
    fawry_ref_number: order.fawry_ref_number,
    total: order.total,
  });

  return getOrderPaymentStatus(orderId);
}
