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
import { attachChargeSignature, signStatusRequest } from './signing';
import type {
  FawryChargeItem,
  FawryChargeRequest,
  FawryOrderStatus,
  FawryPaymentMethod,
} from './types';
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

  // returnUrl is required by Fawry and is part of the charge signature. It can
  // come from the per-request override (the storefront passes an origin-derived
  // URL) or the optional FAWRY_RETURN_URL. Fail loud if neither is present
  // rather than signing with an empty string (which Fawry rejects opaquely).
  const returnUrl = input.returnUrlOverride ?? config.returnUrl;
  if (!returnUrl) {
    throw new Error(
      'buildChargeRequest: no return URL — set FAWRY_RETURN_URL or pass returnUrlOverride'
    );
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
    returnUrl,
    // Per-request webhook URL override. Fawry honours this even when a
    // dashboard URL is set, so it doubles as a way to point sandbox traffic
    // at an ngrok tunnel without touching the Fawry dashboard. When the env
    // var is unset (production), the dashboard URL is the only source.
    orderWebHookUrl: config.webhookUrl ?? undefined,
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

/**
 * The interesting subset of Fawry's payment-status response. We only model
 * the fields the reconciliation path actually reads — the full response has
 * dozens of optional bookkeeping fields we don't care about. Other fields
 * pass through untouched in `raw` for auditing.
 */
export interface FawryStatusResponse {
  type?: string;
  merchantRefNumber: string;
  fawryRefNumber?: string;
  paymentAmount?: number | string;
  orderAmount?: number | string;
  fawryFees?: number | string;
  paymentMethod?: string;
  orderStatus?: FawryOrderStatus;
  paymentTime?: number;
  statusCode?: number | string;
  statusDescription?: string;
  // Anything else Fawry returns.
  [key: string]: unknown;
}

/**
 * GET /ECommerceWeb/api/payments/status/v2 — server-to-server poll of an
 * order's current Fawry state. Used by Slice 7's reconciliation route when
 * the result-page poll loop times out (typically because Fawry's webhook
 * fell behind, common on wallet pushes).
 *
 * Returns the parsed body. Throws on network / non-2xx — callers convert
 * to an audit row rather than failing the request.
 */
export async function fetchPaymentStatus(
  merchantRefNumber: string,
  config: FawryConfig = getFawryConfig()
): Promise<FawryStatusResponse> {
  const signature = signStatusRequest(
    { merchantCode: config.merchantCode, merchantRefNumber },
    config.secureKey
  );
  const url = new URL('/ECommerceWeb/api/payments/status/v2', config.baseUrl);
  url.searchParams.set('merchantCode', config.merchantCode);
  url.searchParams.set('merchantRefNumber', merchantRefNumber);
  url.searchParams.set('signature', signature);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    // Status calls are reconciliation glue; if Fawry is slow we'd rather
    // surface the timeout than block the result page indefinitely.
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`fawry_status_http_${res.status}`);
  }
  return (await res.json()) as FawryStatusResponse;
}
