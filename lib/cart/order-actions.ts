'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
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

  // Create order (DB trigger auto-generates order_number, reserves stock, updates count)
  const { data: order, error: orderErr } = await supa
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

  const { error: itemsErr } = await supa.from('order_items').insert(itemsPayload);
  if (itemsErr) {
    // Roll back the order on item failure (stock reservation also rolls back via trigger)
    await supa.from('orders').delete().eq('id', order.id);
    return { error: translateOrderError(itemsErr.message) };
  }

  return { order_id: order.id, order_number: order.order_number };
}

function translateOrderError(msg: string): string {
  if (msg.includes('OUT_OF_STOCK')) return 'عذرًا، أحد الكتب لم يعد متوفرًا في الفرع المختار';
  if (msg.includes('BOOK_CAP_EXCEEDED')) return 'تجاوزت الحد الأقصى للكتب (10)';
  return msg;
}
