'use server';

/**
 * Server actions that replace POST /api/orders/create and
 * POST /api/fawry/charge for the storefront Fawry checkout flow.
 *
 * Why server actions instead of route handlers (P2-7):
 *   Next.js server actions are CSRF-protected by default — they require
 *   either a same-origin POST with a specific framework-issued action id
 *   or a SSR-bound form action. A malicious third-party site cannot fire
 *   them via fetch() against a logged-in user's cookies, which was the
 *   exposure on the old route handlers.
 *
 * Behaviour is otherwise identical to the old endpoints. The result shape
 * keeps the {ok,data} / {ok:false,error} union so call sites read the
 * same way they did with the JSON response.
 */
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeShipping } from './shipping';
import { releaseAllHoldsForUser } from '@/lib/stock/holds';
import { buildChargeRequest, chargeItemsFromCart } from '@/lib/fawry/client';
import { getFawryConfig } from '@/lib/fawry/config';
import { log } from '@/lib/log';
import type { FawryChargeRequest, FawryPaymentMethod } from '@/lib/fawry/types';
import type { ShippingAreaType } from '@/lib/types';

// =============================================================================
// Shared result shape
// =============================================================================

interface ActionError {
  code: string;
  message: string;
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

function fail(code: string, message: string): { ok: false; error: ActionError } {
  return { ok: false, error: { code, message } };
}

// =============================================================================
// 1. createFawryOrderAction — replaces POST /api/orders/create
// =============================================================================

const PAYMENT_EXPIRY_HOURS = 72;

const SHIPPING_AREAS = [
  'alexandria_city',
  'alexandria_outskirts',
  'kafr_el_dawwar',
  'other_governorate',
] as const satisfies readonly ShippingAreaType[];

const CreateOrderItemSchema = z.object({
  book_id: z.number().int().positive(),
  quantity: z.number().int().positive().max(100),
});

const CreateOrderInputSchema = z
  .object({
    items: z.array(CreateOrderItemSchema).min(1).max(50),
    branch_id: z.string().uuid(),
    fulfillment: z.enum(['pickup', 'delivery']),
    shipping: z
      .object({
        governorate: z.string().min(1).max(120),
        address: z.string().min(1).max(500),
        area_type: z.enum(SHIPPING_AREAS),
      })
      .optional(),
    notes: z.string().max(1000).optional(),
    /** Idempotency key. Moved from HTTP header to action arg — server
     *  actions don't have custom headers. Same semantics: a retry with
     *  the same key returns the original order without creating a second
     *  one. Scoped per student via the partial unique index from
     *  migration 020. */
    idempotency_key: z.string().max(200).optional().nullable(),
  })
  .refine((b) => b.fulfillment === 'pickup' || b.shipping !== undefined, {
    message: 'shipping is required when fulfillment is "delivery"',
    path: ['shipping'],
  });

export type CreateOrderInput = z.input<typeof CreateOrderInputSchema>;

interface CreateOrderSuccess {
  orderId: string;
  merchantRefNumber: string;
  totalAmount: number;
}

export async function createFawryOrderAction(
  input: CreateOrderInput
): Promise<ActionResult<CreateOrderSuccess>> {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return fail('unauthenticated', 'يجب تسجيل الدخول أولاً');

  const parsed = CreateOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail('invalid_request', `${first.path.join('.') || 'body'}: ${first.message}`);
  }
  const body = parsed.data;
  const idempotencyKey = body.idempotency_key?.trim() || null;

  const admin = createAdminClient();

  // 1. Idempotency replay.
  if (idempotencyKey) {
    const { data: prior } = await admin
      .from('orders')
      .select('id, merchant_ref_number, total')
      .eq('student_id', user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (prior) {
      // P2-1: release holds on the replay path too — see history for context.
      void releaseAllHoldsForUser(user.id).catch(() => {});
      return {
        ok: true,
        data: {
          orderId: prior.id,
          merchantRefNumber: prior.merchant_ref_number ?? prior.id,
          totalAmount: Number(prior.total),
        },
      };
    }
  }

  // 2. Cap enforcement using the same authoritative inputs as placeOrder().
  const [{ data: student }, { data: settings }, { data: rates }] = await Promise.all([
    supa
      .from('students')
      .select('books_ordered_count, cap_override')
      .eq('id', user.id)
      .maybeSingle(),
    supa.from('site_settings').select('*').eq('id', 1).maybeSingle(),
    supa.from('shipping_rates').select('area_type, price').eq('is_active', true),
  ]);

  const cap = student?.cap_override ?? settings?.student_book_cap ?? 10;
  const alreadyOrdered = student?.books_ordered_count ?? 0;
  const cartQty = body.items.reduce((s, i) => s + i.quantity, 0);
  if (alreadyOrdered + cartQty > cap) {
    return fail(
      'cap_exceeded',
      `تجاوزت الحد الأقصى للكتب (${cap}). لديك ${alreadyOrdered} كتاب بالفعل ولا يمكن إضافة ${cartQty} أخرى.`
    );
  }

  // 3. Recompute prices server-side.
  const bookIds = body.items.map((i) => i.book_id);
  const { data: dbBooks, error: booksErr } = await supa
    .from('books')
    .select('id, title_ar, final_price, is_active')
    .in('id', bookIds);
  if (booksErr) {
    log.error('orders/create', 'books_lookup_failed', { code: booksErr.code, message: booksErr.message });
    return fail('internal_error', 'تعذّر التحقق من توافر الكتب');
  }

  const priceMap = new Map((dbBooks ?? []).map((b) => [b.id, b]));
  const missing = bookIds.filter((id) => !priceMap.has(id) || !priceMap.get(id)!.is_active);
  if (missing.length > 0) {
    return fail('book_unavailable', `Books not available: ${missing.join(', ')}`);
  }

  const subtotal = body.items.reduce(
    (s, i) => s + i.quantity * Number(priceMap.get(i.book_id)!.final_price),
    0
  );

  // 4. Shipping.
  const rateMap: Record<ShippingAreaType, number> = {
    alexandria_city: 0,
    alexandria_outskirts: 0,
    kafr_el_dawwar: 0,
    other_governorate: 0,
  };
  for (const r of rates ?? []) rateMap[r.area_type as ShippingAreaType] = Number(r.price);

  const quote = computeShipping({
    subtotal,
    fulfillment: body.fulfillment,
    areaType: body.shipping?.area_type ?? null,
    ratePerArea: rateMap,
    freeShippingThreshold: Number(settings?.free_shipping_threshold ?? 2500),
    freeShippingEnabled: settings?.free_shipping_enabled ?? true,
  });
  const total = subtotal + quote.fee;

  // 5. Insert order via service-role client (the notify_admin_new_order
  //    trigger inserts into notifications, which has admin-only RLS).
  const paymentExpiresAt = new Date(
    Date.now() + PAYMENT_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();

  const insertResult = await admin
    .from('orders')
    .insert({
      student_id: user.id,
      branch_id: body.branch_id,
      fulfillment_type: body.fulfillment,
      status: 'pending',
      shipping_governorate: body.shipping?.governorate ?? null,
      shipping_address: body.shipping?.address ?? null,
      shipping_fee: quote.fee,
      subtotal,
      total,
      payment_status: 'pending',
      payment_method: 'fawry',
      payment_type: 'online',
      payment_expires_at: paymentExpiresAt,
      order_source: 'storefront',
      notes: body.notes ?? null,
      idempotency_key: idempotencyKey,
    })
    .select('id, total')
    .single();

  if (insertResult.error || !insertResult.data) {
    // Race: another request beat us with the same idempotency key.
    if (insertResult.error?.code === '23505' && idempotencyKey) {
      const { data: winner } = await admin
        .from('orders')
        .select('id, merchant_ref_number, total')
        .eq('student_id', user.id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (winner) {
        return {
          ok: true,
          data: {
            orderId: winner.id,
            merchantRefNumber: winner.merchant_ref_number ?? winner.id,
            totalAmount: Number(winner.total),
          },
        };
      }
    }
    log.error('orders/create', 'insert_failed', {
      code: insertResult.error?.code,
      message: insertResult.error?.message,
    });
    return fail('order_insert_failed', 'فشل إنشاء الطلب');
  }

  const orderId = insertResult.data.id;

  // 6. Items — the migration-015 trigger reserves branch stock.
  const itemsPayload = body.items.map((i) => ({
    order_id: orderId,
    book_id: i.book_id,
    quantity: i.quantity,
    unit_price: Number(priceMap.get(i.book_id)!.final_price),
  }));

  const { error: itemsErr } = await admin.from('order_items').insert(itemsPayload);
  if (itemsErr) {
    await admin.from('orders').delete().eq('id', orderId);
    if (itemsErr.message.includes('OUT_OF_STOCK')) {
      return fail('out_of_stock', translateOutOfStock(itemsErr.message, priceMap));
    }
    log.error('orders/create', 'items_insert_failed', {
      code: itemsErr.code,
      message: itemsErr.message,
    });
    return fail('items_insert_failed', 'فشل حجز الكتب — حاول مرة أخرى');
  }

  // 7. Stamp merchant_ref_number = id.
  const merchantRefNumber = orderId;
  const { error: refErr } = await admin
    .from('orders')
    .update({ merchant_ref_number: merchantRefNumber })
    .eq('id', orderId);
  if (refErr) {
    log.warn('orders/create', 'ref_stamp_failed', { orderId, message: refErr.message });
    // Non-fatal — the charge action backfills on the way out.
  }

  // 8. Drop cart soft-holds.
  void releaseAllHoldsForUser(user.id).catch(() => {});

  return {
    ok: true,
    data: {
      orderId,
      merchantRefNumber,
      totalAmount: Number(insertResult.data.total),
    },
  };
}

interface BookLookup {
  id?: number;
  title_ar?: string | null;
}

function translateOutOfStock(msg: string, priceMap: Map<number, BookLookup>): string {
  const match = msg.match(/book\s+(\d+)/i);
  const offendingId = match ? Number(match[1]) : null;
  const need = msg.match(/need\s+(\d+)/i)?.[1];
  const avail = msg.match(/avail\s+(\d+)/i)?.[1];
  const title = offendingId ? priceMap.get(offendingId)?.title_ar : null;
  if (title && need && avail) {
    return `«${title}» لم يعد متوفرًا بالكمية المطلوبة في هذا الفرع (طلبت ${need}، المتاح ${avail}).`;
  }
  if (title) {
    return `«${title}» لم يعد متوفرًا بالكمية المطلوبة في هذا الفرع.`;
  }
  return 'أحد الكتب لم يعد متوفرًا بالكمية المطلوبة في هذا الفرع.';
}

// =============================================================================
// 2. getFawryChargePayloadAction — replaces POST /api/fawry/charge
// =============================================================================

const FAWRY_METHODS = ['PayAtFawry', 'MWALLET', 'CARD', 'VALU'] as const satisfies readonly FawryPaymentMethod[];

const ChargeInputSchema = z.object({
  order_id: z.string().uuid(),
  payment_method: z.enum(FAWRY_METHODS).optional(),
});

// Public input type uses the broader FawryPaymentMethod union so call
// sites that pipe through a `PaymentChoice` (which carries the full
// union for the discriminator) don't need to narrow before calling.
// Zod still rejects values outside FAWRY_METHODS at runtime with
// invalid_request, so 'CashOnDelivery' never reaches the signing code.
export interface GetFawryChargeInput {
  order_id: string;
  payment_method?: FawryPaymentMethod;
}

export async function getFawryChargePayloadAction(
  input: GetFawryChargeInput
): Promise<ActionResult<FawryChargeRequest>> {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return fail('unauthenticated', 'يجب تسجيل الدخول أولاً');

  const parsed = ChargeInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail('invalid_request', `${first.path.join('.') || 'body'}: ${first.message}`);
  }
  const { order_id, payment_method } = parsed.data;

  let config;
  try {
    config = getFawryConfig();
  } catch (err) {
    log.error('fawry/charge', 'config_missing', {
      message: err instanceof Error ? err.message : String(err),
    });
    return fail('fawry_not_configured', 'بوابة الدفع غير مهيأة، حاول لاحقًا');
  }

  const admin = createAdminClient();
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select(
      `id, student_id, merchant_ref_number, total, shipping_fee, payment_status, payment_method,
       payment_expires_at,
       student:students(full_name, phone, email),
       items:order_items(quantity, unit_price, book:books(id, title_ar, cover_url))`
    )
    .eq('id', order_id)
    .maybeSingle();

  if (orderErr) {
    log.error('fawry/charge', 'order_lookup_failed', {
      orderId: order_id,
      code: orderErr.code,
      message: orderErr.message,
    });
    return fail('internal_error', 'تعذّر تجهيز عملية الدفع');
  }
  if (!order) return fail('not_found', 'الطلب غير موجود');
  if (order.student_id !== user.id) {
    return fail('forbidden', 'لا تملك صلاحية الوصول إلى هذا الطلب');
  }
  if (order.payment_method !== 'fawry') {
    return fail('wrong_method', 'هذا الطلب ليس مرتبطًا بدفع فوري');
  }
  if (order.payment_status !== 'pending') {
    return fail(
      'not_payable',
      `لا يمكن إعادة الدفع — حالة هذا الطلب الحالية: ${order.payment_status}`
    );
  }

  // Backfill merchant_ref_number if the order was created before that step
  // succeeded (defensive — createFawryOrderAction stamps it but logs a
  // warning if the UPDATE failed).
  let merchantRefNumber = order.merchant_ref_number;
  if (!merchantRefNumber) {
    merchantRefNumber = order.id;
    const { error: refErr } = await admin
      .from('orders')
      .update({ merchant_ref_number: merchantRefNumber })
      .eq('id', order.id);
    if (refErr) {
      log.error('fawry/charge', 'ref_backfill_failed', {
        orderId: order.id,
        message: refErr.message,
      });
      return fail('internal_error', 'تعذّر تجهيز عملية الدفع');
    }
  }

  const items = (order.items ?? []) as unknown as Array<{
    quantity: number;
    unit_price: number | string;
    book: { id: number; title_ar: string; cover_url: string | null } | null;
  }>;
  if (items.length === 0) {
    return fail('empty_order', 'الطلب لا يحتوي على أي كتب');
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

  // The Self-Hosted Checkout Button charges exactly the sum of chargeItems
  // (SIGNING_REFERENCE.md §1 — there's no separate top-level amount field).
  // order.total = subtotal + shipping_fee, so shipping must ride along as its
  // own line item or Fawry only ever charges the book subtotal — which then
  // permanently fails the webhook's amount-mismatch check against order.total.
  const shippingFee = Number(order.shipping_fee ?? 0);
  if (shippingFee > 0) {
    chargeItems.push({
      itemId: 'shipping',
      description: 'رسوم الشحن',
      quantity: 1,
      price: shippingFee,
    });
  }

  const student = (order.student ?? null) as unknown as
    | { full_name: string | null; phone: string | null; email: string | null }
    | null;

  // Server actions don't expose the request object, so we reconstruct the
  // origin from the forwarded headers Next.js + Vercel set.
  const h = await headers();
  const host = h.get('host') ?? h.get('x-forwarded-host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;
  // Prefer an absolute FAWRY_RETURN_URL when configured; otherwise derive it
  // from the request origin. Compute the query separator from the URL we
  // actually use, not from the (possibly unset) env value.
  const returnBase =
    config.returnUrl && config.returnUrl.startsWith('http')
      ? config.returnUrl
      : `${origin}/checkout/result`;
  const returnUrlOverride =
    `${returnBase}${returnBase.includes('?') ? '&' : '?'}orderId=${encodeURIComponent(order.id)}`;

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

  return { ok: true, data: payload };
}
