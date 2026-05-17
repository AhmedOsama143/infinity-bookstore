/**
 * Fawry HTTP/payload builders.
 *
 * `buildChargeRequest()` is a pure function: callers pass in the order +
 * items + customer they've already loaded from Supabase, and it returns a
 * fully-signed payload to hand to `window.FawryPay.checkout(...)`.
 *
 * Server-side only. Reads `getFawryConfig()` for the merchant code, return
 * URL, and secure key.
 */
import { attachChargeSignature } from './signing';
import type { FawryChargeItem, FawryChargeRequest, FawryPaymentMethod } from './types';
import { getFawryConfig, type FawryConfig } from './config';

export interface BuildChargeRequestInput {
  order: {
    /** orders.merchant_ref_number — set on order creation; falls back to id::text. */
    merchantRefNumber: string;
    /** Optional epoch ms. Mainly useful when the customer picks PayAtFawry. */
    paymentExpiryMs?: number;
  };
  items: FawryChargeItem[];
  customer: {
    name?: string;
    email?: string;
    mobile?: string;
    /** Stable per-user identifier. Convention: students.id (== auth.users.id). */
    profileId?: string;
  };
  /**
   * Optional hard-pin to a specific Fawry method. When omitted, Fawry's popup
   * shows every enabled method to the customer. Our checkout UI in Slice 4
   * sets this based on which "طرق الدفع" tile the customer picks.
   */
  paymentMethod?: FawryPaymentMethod;
  /**
   * Optional override for the back-redirect URL, useful for per-order return
   * URLs (e.g. `/orders/{id}/payment-result`). When omitted, falls back to
   * the global FAWRY_RETURN_URL.
   */
  returnUrlOverride?: string;
}

export function buildChargeRequest(
  input: BuildChargeRequestInput,
  config: FawryConfig = getFawryConfig()
): FawryChargeRequest {
  if (input.items.length === 0) {
    throw new Error('buildChargeRequest: items must not be empty');
  }

  const unsigned: Omit<FawryChargeRequest, 'signature'> = {
    merchantCode: config.merchantCode,
    merchantRefNum: input.order.merchantRefNumber,
    customerName: input.customer.name,
    customerEmail: input.customer.email,
    customerMobile: input.customer.mobile,
    customerProfileId: input.customer.profileId,
    paymentExpiry: input.order.paymentExpiryMs,
    chargeItems: input.items,
    paymentMethod: input.paymentMethod,
    returnUrl: input.returnUrlOverride ?? config.returnUrl,
  };

  return attachChargeSignature(unsigned, config.secureKey);
}

/**
 * Map our cart-line shape (book id + price + quantity, optional cover image)
 * onto the FawryChargeItem shape. Centralised here so the route handler in
 * Slice 4 doesn't need to know the wire format.
 */
export function chargeItemsFromCart(
  lines: Array<{
    bookId: number | string;
    title: string;
    quantity: number;
    unitPrice: number;
    coverUrl?: string | null;
  }>
): FawryChargeItem[] {
  return lines.map((l) => ({
    itemId: String(l.bookId),
    description: l.title,
    quantity: l.quantity,
    price: l.unitPrice,
    imageUrl: l.coverUrl ?? undefined,
  }));
}
