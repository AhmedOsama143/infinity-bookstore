// GA4 ecommerce events pushed into the GTM dataLayer.
//
// The flow is: client code calls one of the typed helpers below, which pushes
// a `{ event, ecommerce }` payload. A GA4 Event tag in GTM (matching the same
// event name) forwards it to GA4. The `ecommerce: null` reset before each
// push is the GA4-recommended pattern to prevent stale items leaking across
// events (https://developers.google.com/analytics/devguides/collection/ga4/ecommerce).

import type { CartItem } from '@/lib/cart/types';

const CURRENCY = 'EGP';

export interface GA4Item {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
  item_brand?: string;
  item_category?: string;
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function push(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push(payload);
}

export interface ItemSource {
  book_id: number | string;
  title_ar: string;
  unit_price?: number;
  final_price?: number;
  price?: number;
  quantity?: number;
  teacher_name?: string | null;
  teacher?: { name_ar?: string | null } | null;
  grade_level?: string | null;
}

export function toGA4Item(src: ItemSource): GA4Item {
  const price = src.unit_price ?? src.final_price ?? src.price ?? 0;
  return {
    item_id: String(src.book_id),
    item_name: src.title_ar,
    price,
    quantity: src.quantity,
    item_brand: src.teacher_name ?? src.teacher?.name_ar ?? undefined,
    item_category: src.grade_level ?? undefined,
  };
}

export function trackViewItem(src: ItemSource): void {
  const item = toGA4Item(src);
  push({
    event: 'view_item',
    ecommerce: { currency: CURRENCY, value: item.price, items: [item] },
  });
}

export function trackSelectItem(src: ItemSource, listName?: string): void {
  const item = toGA4Item(src);
  push({
    event: 'select_item',
    ecommerce: { item_list_name: listName, items: [item] },
  });
}

export function trackAddToCart(src: ItemSource, quantity = 1): void {
  const item = { ...toGA4Item(src), quantity };
  push({
    event: 'add_to_cart',
    ecommerce: { currency: CURRENCY, value: item.price * quantity, items: [item] },
  });
}

export function trackRemoveFromCart(src: ItemSource, quantity = 1): void {
  const item = { ...toGA4Item(src), quantity };
  push({
    event: 'remove_from_cart',
    ecommerce: { currency: CURRENCY, value: item.price * quantity, items: [item] },
  });
}

export function trackViewCart(items: CartItem[], subtotal: number): void {
  push({
    event: 'view_cart',
    ecommerce: {
      currency: CURRENCY,
      value: subtotal,
      items: items.map((i) => toGA4Item(i)),
    },
  });
}

export function trackBeginCheckout(items: CartItem[], subtotal: number): void {
  push({
    event: 'begin_checkout',
    ecommerce: {
      currency: CURRENCY,
      value: subtotal,
      items: items.map((i) => toGA4Item(i)),
    },
  });
}

export function trackAddPaymentInfo(
  items: CartItem[],
  subtotal: number,
  paymentType: string,
): void {
  push({
    event: 'add_payment_info',
    ecommerce: {
      currency: CURRENCY,
      value: subtotal,
      payment_type: paymentType,
      items: items.map((i) => toGA4Item(i)),
    },
  });
}

export interface PurchasePayload {
  transactionId: string;
  value: number;
  shipping?: number;
  tax?: number;
  coupon?: string;
  items: ItemSource[];
  paymentType?: string;
}

export function trackPurchase(p: PurchasePayload): void {
  push({
    event: 'purchase',
    ecommerce: {
      transaction_id: p.transactionId,
      currency: CURRENCY,
      value: p.value,
      shipping: p.shipping,
      tax: p.tax,
      coupon: p.coupon,
      payment_type: p.paymentType,
      items: p.items.map((i) => toGA4Item(i)),
    },
  });
}
