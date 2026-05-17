'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { releaseAllHoldsForUser } from '@/lib/stock/holds';
import { logFunnelEvent } from '@/lib/analytics/server';
import type { CartItem } from './types';
import type { ShippingAreaType, FulfillmentType } from '@/lib/types';
import { computeShipping } from './shipping';

interface PlaceOrderInput {
  items: CartItem[];
  fulfillment: FulfillmentType;
  branch_id: string;
  shipping_governorate?: string;
  shipping_address?: string;
  shipping_area_type?: ShippingAreaType;
  notes?: string;
}

export interface PlaceOrderResult {
  error?: string;
  order_id?: string;
  order_number?: string;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: 'يجب تسجيل الدخول أولاً' };
  if (input.items.length === 0) return { error: 'السلة فارغة' };

  // Re-fetch cap + settings + rates server-side (don't trust client numbers)
  const [{ data: student }, { data: settings }, { data: rates }] = await Promise.all([
    supa.from('students').select('books_ordered_count, cap_override, grade_level').eq('id', user.id).maybeSingle(),
    supa.from('site_settings').select('*').eq('id', 1).maybeSingle(),
    supa.from('shipping_rates').select('area_type, price').eq('is_active', true),
  ]);

  const cap = student?.cap_override ?? settings?.student_book_cap ?? 10;
  const alreadyOrdered = student?.books_ordered_count ?? 0;
  const cartQty = input.items.reduce((s, i) => s + i.quantity, 0);
  if (alreadyOrdered + cartQty > cap) {
    return {
      error: `تجاوزت الحد الأقصى للكتب (${cap}). لديك ${alreadyOrdered} كتاب بالفعل ولا يمكن إضافة ${cartQty} أخرى.`,
    };
  }

  // Re-fetch book prices server-side (don't trust client prices)
  const bookIds = input.items.map((i) => i.book_id);
  const { data: dbBooks } = await supa
    .from('books')
    .select('id, title_ar, final_price, is_active')
    .in('id', bookIds);
  const priceMap = new Map((dbBooks ?? []).map((b) => [b.id, b]));
  const subtotal = input.items.reduce((s, i) => {
    const book = priceMap.get(i.book_id);
    if (!book || !book.is_active) return s;
    return s + i.quantity * Number(book.final_price);
  }, 0);

  // Shipping
  const rateMap: Record<ShippingAreaType, number> = {
    alexandria_city: 0,
    alexandria_outskirts: 0,
    kafr_el_dawwar: 0,
    other_governorate: 0,
  };
  for (const r of rates ?? []) rateMap[r.area_type as ShippingAreaType] = Number(r.price);

  const quote = computeShipping({
    subtotal,
    fulfillment: input.fulfillment,
    areaType: input.shipping_area_type,
    ratePerArea: rateMap,
    freeShippingThreshold: Number(settings?.free_shipping_threshold ?? 2500),
    freeShippingEnabled: settings?.free_shipping_enabled ?? true,
  });

  const total = subtotal + quote.fee;

  // Use the service-role client for the writes. This is required because the
  // notify_admin_new_order trigger (and similar) inserts into the notifications
  // table, which has admin-only RLS — under the user's session those trigger
  // inserts get blocked. All inputs above are already validated server-side
  // (auth, cap, prices, books), so RLS isn't the primary safety net here.
  const admin = createAdminClient();

  // Create order (DB trigger auto-generates order_number, reserves stock, updates count)
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      student_id: user.id,
      branch_id: input.branch_id,
      fulfillment_type: input.fulfillment,
      status: 'pending',
      shipping_governorate: input.shipping_governorate ?? null,
      shipping_address: input.shipping_address ?? null,
      shipping_fee: quote.fee,
      subtotal,
      total,
      payment_status: 'pending',
      payment_method: 'cod',
      payment_type: 'offline',
      order_source: 'storefront',
      notes: input.notes ?? null,
    })
    .select('id, order_number')
    .single();

  if (orderErr || !order) {
    return { error: orderErr?.message ?? 'فشل إنشاء الطلب' };
  }

  // Insert items (triggers soft-reservation)
  const itemsPayload = input.items
    .filter((i) => priceMap.has(i.book_id))
    .map((i) => ({
      order_id: order.id,
      book_id: i.book_id,
      quantity: i.quantity,
      unit_price: Number(priceMap.get(i.book_id)!.final_price),
    }));

  const { error: itemsErr } = await admin.from('order_items').insert(itemsPayload);
  if (itemsErr) {
    // Roll back the order on item failure (stock reservation also rolls back via trigger)
    await admin.from('orders').delete().eq('id', order.id);
    return {
      error: translateOrderError(itemsErr.message, priceMap),
    };
  }

  // Order is in. The per-branch reservation now supersedes the cart-level
  // soft-hold; drop the user's holds so other shoppers regain visibility.
  void releaseAllHoldsForUser(user.id).catch(() => {});

  // Server-side conversion log. COD orders are conversions the moment they're
  // placed (payment happens later, in person) — match how we count them in
  // the operations dashboard.
  void logFunnelEvent(admin, {
    event: 'purchase',
    user_id: user.id,
    order_id: order.id,
    value: total,
    props: {
      payment_method: 'cod',
      fulfillment: input.fulfillment,
      items_count: cartQty,
      subtotal,
      shipping_fee: quote.fee,
    },
  });

  // Confirmation email — fire-and-forget so the checkout response isn't blocked.
  if (user.email) {
    const html = `<!doctype html><html dir="rtl" lang="ar"><body style="font-family:Tajawal,Arial,sans-serif;background:#f2f2f7;padding:20px;margin:0">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#3c655a,#578e7e);padding:24px;color:#fff;text-align:center">
          <h1 style="margin:0;font-size:20px">مركز <span style="color:#e3af64">إنفينيتي</span></h1>
        </div>
        <div style="padding:28px;color:#161618;line-height:1.8">
          <h2 style="color:#3c655a;margin:0 0 12px">📚 شكرًا لطلبك!</h2>
          <p>تم استلام طلبك رقم <b>${order.order_number}</b> وجارٍ مراجعته.</p>
          <p style="background:#f2f2f7;padding:12px;border-radius:8px;font-size:14px">
            <strong>الإجمالي:</strong> ${total.toFixed(0)} جنيه<br>
            <strong>طريقة الدفع:</strong> كاش عند الاستلام
          </p>
          <p style="font-size:13px;color:#666">سنتواصل معك لتأكيد الطلب خلال ٢٤ ساعة.</p>
        </div>
      </div>
    </body></html>`;
    sendEmail({
      to: user.email,
      subject: `📚 تم استلام طلبك ${order.order_number}`,
      html,
    }).catch(() => {});
  }

  return { order_id: order.id, order_number: order.order_number };
}

interface BookLookup {
  id?: number;
  title_ar?: string | null;
}

function translateOrderError(msg: string, priceMap?: Map<number, BookLookup>): string {
  if (msg.includes('OUT_OF_STOCK')) {
    // Trigger format: "OUT_OF_STOCK: book <id> not available at branch <uuid> (need <n>, avail <n>)"
    const match = msg.match(/book\s+(\d+)/i);
    const offendingId = match ? Number(match[1]) : null;
    const need = msg.match(/need\s+(\d+)/i)?.[1];
    const avail = msg.match(/avail\s+(\d+)/i)?.[1];
    const title = offendingId && priceMap ? priceMap.get(offendingId)?.title_ar : null;
    if (title && need && avail) {
      return `«${title}» لم يعد متوفرًا بالكمية المطلوبة في هذا الفرع (طلبت ${need}، المتاح ${avail}). راجع السلة وأعد المحاولة.`;
    }
    if (title) {
      return `«${title}» لم يعد متوفرًا بالكمية المطلوبة في هذا الفرع. راجع السلة وأعد المحاولة.`;
    }
    return 'أحد الكتب لم يعد متوفرًا بالكمية المطلوبة في هذا الفرع. راجع السلة وأعد المحاولة.';
  }
  if (msg.includes('BOOK_CAP_EXCEEDED')) return 'تجاوزت الحد الأقصى للكتب (10)';
  return msg;
}
