/**
 * GET /api/fawry/status/[ref] — server-to-server poll of Fawry for the current
 * payment status of a specific order, with optional reconciliation if the
 * webhook fell behind.
 *
 * Slice 7. Authorised callers:
 *   • The owning student (auth session).
 *   • Any row in admin_users.
 *
 * The actual reconciliation logic lives in lib/fawry/reconcile.ts so the
 * result-page server action and the Slice-8 cleanup cron can share it.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reconcileOrderWithFawry } from '@/lib/fawry/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ ref: string }>;
}

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const { ref } = await ctx.params;
  if (!ref || ref.length > 200) {
    return fail('invalid_request', 'invalid merchantRefNumber', 400);
  }

  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return fail('unauthenticated', 'login required', 401);

  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select(
      'id, status, payment_status, payment_method, payment_method_detail, fawry_ref_number, student_id, total'
    )
    .eq('merchant_ref_number', ref)
    .maybeSingle();

  if (orderErr) return fail('internal_error', orderErr.message, 500);
  if (!order) return fail('not_found', 'order not found', 404);

  if (order.student_id !== user.id) {
    const { data: staff } = await admin
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (!staff) return fail('forbidden', 'not your order', 403);
  }

  if (order.payment_method !== 'fawry') {
    return NextResponse.json({
      ok: true,
      data: {
        orderId: order.id,
        payment_status: order.payment_status,
        status: order.status,
        fawry_status: null,
        payment_method_detail: order.payment_method_detail,
        fawry_ref_number: order.fawry_ref_number,
        reconciled: false,
        reason: 'not_fawry_order',
      },
    });
  }

  const result = await reconcileOrderWithFawry(admin, ref, {
    id: order.id,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    payment_method_detail: order.payment_method_detail,
    fawry_ref_number: order.fawry_ref_number,
    total: order.total,
  });

  return NextResponse.json({ ok: true, data: result });
}
