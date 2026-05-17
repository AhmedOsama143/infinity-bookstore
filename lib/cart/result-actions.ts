'use server';

import { createClient } from '@/lib/supabase/server';

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
