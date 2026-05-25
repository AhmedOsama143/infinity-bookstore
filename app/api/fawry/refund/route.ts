/**
 * POST /api/fawry/refund — staff-only refund of a previously paid Fawry order.
 *
 * Slice 10. Builds a signed refund request via lib/fawry/signing.ts → signRefund,
 * POSTs to Fawry's server-to-server refund endpoint, flips
 * orders.payment_status to 'refunded' on success, and logs to payment_events
 * for the audit timeline shown in /admin/payments/[id].
 *
 * Authorisation: requireAdmin() — branch managers and full admins both
 * qualify. The refund button is gated client-side too, but the route is the
 * authoritative check.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFawryConfig } from '@/lib/fawry/config';
import { signRefund, toFawryAmount } from '@/lib/fawry/signing';
import type { AdminRole } from '@/lib/admin/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RefundBodySchema = z.object({
  orderId: z.string().uuid(),
  refundAmount: z.number().positive().max(1_000_000),
  reason: z.string().max(200).optional(),
});

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  // Inline admin check — requireAdmin() in lib/admin/auth.ts calls redirect()
  // on failure, which is correct for pages but breaks a JSON API.
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return fail('unauthenticated', 'login required', 401);

  const adminClient = createAdminClient();
  const { data: staffRow } = await adminClient
    .from('admin_users')
    .select('id, role, branch_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!staffRow) return fail('forbidden', 'admin only', 403);
  const staff = {
    userId: user.id,
    role: staffRow.role as AdminRole,
    branchId: staffRow.branch_id as string | null,
  };

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail('invalid_request', 'body must be valid JSON', 400);
  }

  const parsed = RefundBodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail('invalid_request', `${first.path.join('.') || 'body'}: ${first.message}`, 400);
  }
  const { orderId, refundAmount, reason } = parsed.data;

  const admin = adminClient;

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select(
      'id, status, payment_status, payment_method, payment_amount, total, fawry_ref_number, merchant_ref_number, branch_id'
    )
    .eq('id', orderId)
    .maybeSingle();
  if (orderErr) return fail('internal_error', orderErr.message, 500);
  if (!order) return fail('not_found', 'order not found', 404);

  // Branch managers can only refund their own branch's orders.
  if (staff.role === 'branch_manager' && staff.branchId && order.branch_id !== staff.branchId) {
    return fail('forbidden', 'not your branch', 403);
  }

  if (order.payment_method !== 'fawry') {
    return fail('invalid_state', 'only Fawry orders are refundable here', 400);
  }
  if (order.payment_status !== 'paid') {
    return fail('invalid_state', `cannot refund payment_status=${order.payment_status}`, 400);
  }
  if (!order.fawry_ref_number) {
    return fail('invalid_state', 'missing fawry_ref_number — refund not possible', 400);
  }

  const paidAmount = Number(order.payment_amount ?? order.total ?? 0);
  if (refundAmount > paidAmount + 0.01) {
    return fail(
      'invalid_state',
      `refund (${refundAmount}) exceeds paid amount (${paidAmount})`,
      400
    );
  }

  let config;
  try {
    config = getFawryConfig();
  } catch (err) {
    return fail('config_error', err instanceof Error ? err.message : 'config error', 500);
  }

  const signature = signRefund(
    {
      merchantCode: config.merchantCode,
      fawryRefNumber: order.fawry_ref_number,
      refundAmount,
      reason,
    },
    config.secureKey
  );

  const body = {
    merchantCode: config.merchantCode,
    referenceNumber: order.fawry_ref_number,
    refundAmount: toFawryAmount(refundAmount),
    reason: reason ?? '',
    signature,
  };

  let fawryResponse: unknown = null;
  let fawryError: string | null = null;
  try {
    const url = new URL('/ECommerceWeb/api/payments/refund', config.baseUrl).toString();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    fawryResponse = await res.json().catch(() => ({ raw: 'non_json_response' }));
    if (!res.ok) {
      fawryError = `fawry_http_${res.status}`;
    } else if (
      typeof fawryResponse === 'object' &&
      fawryResponse !== null &&
      'statusCode' in fawryResponse &&
      Number((fawryResponse as { statusCode: number | string }).statusCode) !== 200
    ) {
      const sc = (fawryResponse as { statusCode: number | string; statusDescription?: string });
      fawryError = `fawry_status_${sc.statusCode}:${sc.statusDescription ?? ''}`;
    }
  } catch (err) {
    fawryError = err instanceof Error ? err.message : 'fawry_unreachable';
  }

  // Always log the attempt — successes mark processed=true, failures keep
  // processed=false so support can spot stuck refunds.
  await admin.from('payment_events').insert({
    merchant_ref_number: order.merchant_ref_number ?? order.id,
    order_id: order.id,
    event_type: 'refund',
    raw_payload: {
      request: { ...body, signature: '[redacted]' },
      response: fawryResponse,
      initiated_by: staff.userId,
      refundAmount,
      reason: reason ?? null,
    },
    signature_valid: true,
    processed: !fawryError,
    error_message: fawryError,
  });

  if (fawryError) {
    // Detail (`fawry_status_500:invalid_ref`, etc.) is already on the
    // payment_events audit row above — staff can read it from /admin/payments.
    // Don't leak it to the API client; HTTP 502 + a generic code is enough.
    console.error('[fawry/refund] refund attempt failed:', fawryError);
    return fail('fawry_refund_failed', 'refund could not be completed', 502);
  }

  // Flip the order. Partial refunds (refundAmount < paidAmount) still mark the
  // order 'refunded' — track partial refunds in payment_events only. Matches
  // the migration-019 schema decision.
  const { error: updErr } = await admin
    .from('orders')
    .update({ payment_status: 'refunded' })
    .eq('id', order.id);

  if (updErr) {
    return fail('order_update_failed', updErr.message, 500);
  }

  return NextResponse.json({ ok: true, data: { orderId: order.id, refundAmount } });
}
