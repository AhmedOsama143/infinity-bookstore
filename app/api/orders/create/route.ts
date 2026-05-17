/**
 * POST /api/orders/create — creates a pending order earmarked for Fawry payment.
 *
 * Slice 2 of the Fawry integration. Builds an `orders` row with
 * payment_method='fawry', payment_type='online', payment_status='pending',
 * inserts items (the trigger from migration 015 reserves branch stock
 * atomically), then assigns merchant_ref_number = id::text. Returns the
 * order_id, the ref to send to Fawry, and the total to charge.
 *
 * Idempotency: the optional `Idempotency-Key` request header is stored on
 * the row and indexed unique per student. A retry with the same key returns
 * the original order without creating a second one.
 *
 * The COD storefront flow (`placeOrder` server action) is unchanged. This
 * route only exists for the online-payment path.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeShipping } from '@/lib/cart/shipping';
import { releaseAllHoldsForUser } from '@/lib/stock/holds';
import type { ShippingAreaType } from '@/lib/types';

// Fawry's PAYATFAWRY references can sit unpaid for up to 72h. We mirror that
// window into payment_expires_at so the eventual sweeper (Slice 8) has a
// concrete deadline to compare against without rebuilding the rule per order.
const PAYMENT_EXPIRY_HOURS = 72;

const SHIPPING_AREAS = [
  'alexandria_city',
  'alexandria_outskirts',
  'kafr_el_dawwar',
  'other_governorate',
] as const satisfies readonly ShippingAreaType[];

const ItemSchema = z.object({
  book_id: z.number().int().positive(),
  quantity: z.number().int().positive().max(100),
});

const CreateOrderBodySchema = z
  .object({
    items: z.array(ItemSchema).min(1).max(50),
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
  })
  .refine((b) => b.fulfillment === 'pickup' || b.shipping !== undefined, {
    message: 'shipping is required when fulfillment is "delivery"',
    path: ['shipping'],
  });

type CreateOrderBody = z.infer<typeof CreateOrderBodySchema>;

interface SuccessPayload {
  orderId: string;
  merchantRefNumber: string;
  totalAmount: number;
}

function ok(data: SuccessPayload, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
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

  const parsed = CreateOrderBodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(
      'invalid_request',
      `${first.path.join('.') || 'body'}: ${first.message}`,
      400
    );
  }
  const body: CreateOrderBody = parsed.data;

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() || null;
  if (idempotencyKey && idempotencyKey.length > 200) {
    return fail('invalid_request', 'Idempotency-Key too long (max 200 chars)', 400);
  }

  const admin = createAdminClient();

  // 1. Idempotency replay — return the prior order verbatim.
  if (idempotencyKey) {
    const { data: prior } = await admin
      .from('orders')
      .select('id, merchant_ref_number, total')
      .eq('student_id', user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (prior) {
      // P2-1: the original order has already reserved branch stock via the
      // migration-015 trigger, so the cart-level soft-holds are redundant.
      // The non-replay path drops them at the end of this handler — mirror
      // that here so a retry within the hold window doesn't leave stale holds
      // alive until they naturally expire.
      void releaseAllHoldsForUser(user.id).catch(() => {});
      return ok(
        {
          orderId: prior.id,
          merchantRefNumber: prior.merchant_ref_number ?? prior.id,
          totalAmount: Number(prior.total),
        },
        200
      );
    }
  }

  // 2. Pull the same authoritative data placeOrder() does — student cap,
  //    site settings, shipping rates — so the Fawry path obeys the same rules
  //    as COD checkout.
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
      `تجاوزت الحد الأقصى للكتب (${cap}). لديك ${alreadyOrdered} كتاب بالفعل ولا يمكن إضافة ${cartQty} أخرى.`,
      409
    );
  }

  // 3. Recompute prices server-side. Never trust client-supplied prices.
  const bookIds = body.items.map((i) => i.book_id);
  const { data: dbBooks, error: booksErr } = await supa
    .from('books')
    .select('id, title_ar, final_price, is_active')
    .in('id', bookIds);
  if (booksErr) return fail('internal_error', booksErr.message, 500);

  const priceMap = new Map((dbBooks ?? []).map((b) => [b.id, b]));
  const missing = bookIds.filter((id) => !priceMap.has(id) || !priceMap.get(id)!.is_active);
  if (missing.length > 0) {
    return fail('book_unavailable', `Books not available: ${missing.join(', ')}`, 409);
  }

  const subtotal = body.items.reduce((s, i) => {
    return s + i.quantity * Number(priceMap.get(i.book_id)!.final_price);
  }, 0);

  // 4. Shipping — same compute path as the storefront.
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

  // 5. Insert the order. Service-role client because the
  //    notify_admin_new_order trigger writes into notifications, which has
  //    admin-only RLS — under the user session those inserts get blocked.
  const paymentExpiresAt = new Date(Date.now() + PAYMENT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

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
    // Race: another request beat us to it with the same idempotency key.
    // Re-read and return the winner.
    if (insertResult.error?.code === '23505' && idempotencyKey) {
      const { data: winner } = await admin
        .from('orders')
        .select('id, merchant_ref_number, total')
        .eq('student_id', user.id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (winner) {
        return ok({
          orderId: winner.id,
          merchantRefNumber: winner.merchant_ref_number ?? winner.id,
          totalAmount: Number(winner.total),
        });
      }
    }
    return fail(
      'order_insert_failed',
      insertResult.error?.message ?? 'فشل إنشاء الطلب',
      500
    );
  }

  const orderId = insertResult.data.id;

  // 6. Insert items — the trigger from migration 015 reserves branch stock
  //    atomically and raises OUT_OF_STOCK if any line can't be fulfilled.
  const itemsPayload = body.items.map((i) => ({
    order_id: orderId,
    book_id: i.book_id,
    quantity: i.quantity,
    unit_price: Number(priceMap.get(i.book_id)!.final_price),
  }));

  const { error: itemsErr } = await admin.from('order_items').insert(itemsPayload);
  if (itemsErr) {
    // Roll back the order so the student isn't left with an unpopulated
    // pending row. The reservation trigger releases stock automatically when
    // the items rows go away (cascade delete), and deleting the order itself
    // doesn't require restoring anything because no items were committed.
    await admin.from('orders').delete().eq('id', orderId);

    if (itemsErr.message.includes('OUT_OF_STOCK')) {
      return fail('out_of_stock', translateOutOfStock(itemsErr.message, priceMap), 409);
    }
    return fail('items_insert_failed', itemsErr.message, 500);
  }

  // 7. Stamp the merchant ref now that we have an id. Convention:
  //    merchant_ref_number = id::text — see migration 019 column comment.
  const merchantRefNumber = orderId;
  const { error: refErr } = await admin
    .from('orders')
    .update({ merchant_ref_number: merchantRefNumber })
    .eq('id', orderId);
  if (refErr) {
    // Non-fatal: the order is real and reservable. The downstream Fawry
    // charge endpoint can backfill before signing if it's still null.
    console.warn('Failed to set merchant_ref_number on order', orderId, refErr.message);
  }

  // 8. The per-branch reservation supersedes the cart-level soft-hold. Drop
  //    the user's holds so other shoppers regain visibility.
  void releaseAllHoldsForUser(user.id).catch(() => {});

  return ok({
    orderId,
    merchantRefNumber,
    totalAmount: Number(insertResult.data.total),
  });
}

interface BookLookup {
  id?: number;
  title_ar?: string | null;
}

function translateOutOfStock(msg: string, priceMap: Map<number, BookLookup>): string {
  // Trigger format: "OUT_OF_STOCK: book <id> not available at branch <uuid> (need <n>, avail <n>)"
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
