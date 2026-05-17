/**
 * POST /api/fawry/charge — builds the signed FawryChargeRequest the browser
 * hands to `window.FawryPay.checkout(...)`.
 *
 * This is Slice 4 of the integration. The endpoint is the line between
 * trusted (server) and untrusted (browser) — it's the only place the secure
 * key touches the wire. The browser only ever sees a signed payload, never
 * the key itself.
 *
 * Auth: the order must belong to the calling student. The endpoint also
 * refuses to re-sign an order that's already paid/cancelled/expired.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildChargeRequest, chargeItemsFromCart } from '@/lib/fawry/client';
import { getFawryConfig } from '@/lib/fawry/config';
import type { FawryPaymentMethod } from '@/lib/fawry/types';

const FAWRY_METHODS = ['PayAtFawry', 'MWALLET', 'CARD', 'VALU'] as const satisfies readonly FawryPaymentMethod[];

const ChargeBodySchema = z.object({
  order_id: z.string().uuid(),
  payment_method: z.enum(FAWRY_METHODS).optional(),
});

function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data });
}

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return fail('unauthenticated', 'يجب تسجيل الدخول أولاً', 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail('invalid_request', 'Body must be valid JSON', 400);
  }
  const parsed = ChargeBodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail('invalid_request', `${first.path.join('.') || 'body'}: ${first.message}`, 400);
  }
  const { order_id, payment_method } = parsed.data;

  let config;
  try {
    config = getFawryConfig();
  } catch (err) {
    return fail(
      'fawry_not_configured',
      err instanceof Error ? err.message : 'Fawry environment not configured',
      500
    );
  }

  // Use the service-role client for the read so we get a consistent view
  // regardless of RLS (the user is verified above by id match).
  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select(
      `id, student_id, merchant_ref_number, total, payment_status, payment_method,
       payment_expires_at,
       student:students(full_name, phone, email),
       items:order_items(quantity, unit_price, book:books(id, title_ar, cover_url))`
    )
    .eq('id', order_id)
    .maybeSingle();

  if (orderErr) return fail('internal_error', orderErr.message, 500);
  if (!order) return fail('not_found', 'الطلب غير موجود', 404);
  if (order.student_id !== user.id) {
    return fail('forbidden', 'لا تملك صلاحية الوصول إلى هذا الطلب', 403);
  }
  if (order.payment_method !== 'fawry') {
    return fail('wrong_method', 'هذا الطلب ليس مرتبطًا بدفع فوري', 409);
  }
  if (order.payment_status !== 'pending') {
    return fail(
      'not_payable',
      `لا يمكن إعادة الدفع — حالة هذا الطلب الحالية: ${order.payment_status}`,
      409
    );
  }

  // Backfill merchant_ref_number if the order was created before that step
  // succeeded (defensive — see route.ts comment in /api/orders/create).
  let merchantRefNumber = order.merchant_ref_number;
  if (!merchantRefNumber) {
    merchantRefNumber = order.id;
    const { error: refErr } = await admin
      .from('orders')
      .update({ merchant_ref_number: merchantRefNumber })
      .eq('id', order.id);
    if (refErr) return fail('internal_error', `Failed to set merchant_ref_number: ${refErr.message}`, 500);
  }

  // Supabase typings flatten join hints to arrays even for single-row FKs;
  // cast through unknown to the actual one-to-one shape we joined on.
  const items = (order.items ?? []) as unknown as Array<{
    quantity: number;
    unit_price: number | string;
    book: { id: number; title_ar: string; cover_url: string | null } | null;
  }>;
  if (items.length === 0) {
    return fail('empty_order', 'الطلب لا يحتوي على أي كتب', 409);
  }

  const chargeItems = chargeItemsFromCart(
    items
      .filter((it) => it.book !== null)
      .map((it) => ({
        bookId: it.book!.id,
        title: it.book!.title_ar,
        quantity: it.quantity,
        unitPrice: Number(it.unit_price),
        coverUrl: it.book!.cover_url,
      }))
  );

  const student = (order.student ?? null) as unknown as
    | { full_name: string | null; phone: string | null; email: string | null }
    | null;

  // Fawry's redirect appends its own response params to whatever returnUrl we
  // give it. Stamping orderId here lets the result page look up the order
  // without needing it in a cookie or local storage.
  const origin = new URL(request.url).origin;
  const returnUrlOverride =
    `${config.returnUrl.startsWith('http') ? config.returnUrl : `${origin}/checkout/result`}` +
    `${config.returnUrl.includes('?') ? '&' : '?'}orderId=${encodeURIComponent(order.id)}`;

  const payload = buildChargeRequest(
    {
      order: {
        merchantRefNumber,
        paymentExpiryMs: order.payment_expires_at
          ? new Date(order.payment_expires_at).getTime()
          : undefined,
      },
      items: chargeItems,
      customer: {
        name: student?.full_name ?? undefined,
        email: student?.email ?? undefined,
        mobile: student?.phone ?? undefined,
        profileId: user.id,
      },
      paymentMethod: payment_method,
      returnUrlOverride,
    },
    config
  );

  return ok(payload);
}
