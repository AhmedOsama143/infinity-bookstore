/**
 * Fawry Pay — types for the Self-Hosted Checkout Button integration.
 *
 * Mirrors the official payload shapes from
 * https://developer.fawrystaging.com/docs/express-checkout/self-hosted-checkout
 * and the Server Notification V2 webhook spec. When Fawry changes a field,
 * update here AND `docs/fawry/SIGNING_REFERENCE.md` together.
 */

export type FawryDisplayMode = 'POPUP' | 'INSIDE_PAGE' | 'SIDE_PAGE' | 'SEPARATED';

/**
 * The high-level method enum exposed by the Express Checkout API. Each tile
 * in our checkout UI maps to one of these:
 *   PayAtFawry  → الرقم المرجعي (reference number, paid at any Fawry kiosk)
 *   MWALLET     → الدفع بواسطة ماي فوري (mobile wallet push)
 *   CARD        → بطاقة الدفع أو بطاقة الخصم (Visa/Mastercard) and بطاقة فوري
 *                 (Fawry's own card — handled inside the CARD popup)
 *   VALU        → installments
 *   CashOnDelivery → kept for completeness; this site routes COD through the
 *                    existing storefront flow, not Fawry, so it's not used.
 */
export type FawryPaymentMethod =
  | 'CashOnDelivery'
  | 'PayAtFawry'
  | 'MWALLET'
  | 'CARD'
  | 'VALU';

/**
 * Allow-list of payment_method_detail strings we'll accept onto the orders
 * row. Anything Fawry sends outside this set goes to the audit row's
 * error_message field and is dropped from the column, so the staff UI's
 * expected enum stays clean. Used by both the webhook handler AND the
 * reconciliation path — keep them in sync by importing from here.
 *
 * Note: Fawry's wire values for PayAtFawry are `PAYATFAWRY` (webhook) and
 * `PayAtFawry` (some status responses). Listing both intentionally.
 */
export const KNOWN_PAYMENT_METHODS: ReadonlySet<string> = new Set<string>([
  'PAYATFAWRY',
  'PayAtFawry',
  'MWALLET',
  'CARD',
  'VALU',
  'CashOnDelivery',
]);

export interface FawryChargeItem {
  itemId: string;
  description?: string;
  /**
   * Two-decimal-string when serialized for the network and for signing.
   * Stored as a number here for type safety; the signing helper handles
   * formatting.
   */
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface FawryShippingAddress {
  governorate: string;
  city: string;
  area: string;
  address: string;
  receiverName: string;
}

/**
 * The exact JSON we hand to `window.FawryPay.checkout(...)`. The signature
 * is computed server-side; clients receive this payload pre-signed.
 */
export interface FawryChargeRequest {
  merchantCode: string;
  merchantRefNum: string;
  customerMobile?: string;
  customerEmail?: string;
  customerName?: string;
  customerProfileId?: string;
  /** Epoch ms. Optional. Mainly relevant for PayAtFawry references. */
  paymentExpiry?: number;
  chargeItems: FawryChargeItem[];
  selectedShippingAddress?: FawryShippingAddress;
  /** Lock the customer to one method, or omit to let Fawry's popup show all. */
  paymentMethod?: FawryPaymentMethod;
  returnUrl: string;
  orderWebHookUrl?: string;
  saveCardInfo?: boolean;
  authCaptureModePayment?: boolean;
  /** SHA-256 hex, lowercase. See SIGNING_REFERENCE.md §1. */
  signature: string;
}

/** What Fawry returns synchronously from the popup (also surfaced as URL params on the redirect). */
export interface FawryChargeResponse {
  type: 'ChargeResponse';
  referenceNumber?: string;
  merchantRefNumber: string;
  /** "20.00" — two-decimal string. */
  orderAmount: string;
  /** "20.00" — two-decimal string, equal to orderAmount + fawryFees. */
  paymentAmount: string;
  fawryFees?: string;
  paymentMethod: FawryPaymentMethod;
  orderStatus: FawryOrderStatus;
  paymentTime?: number;
  customerMobile?: string;
  customerMail?: string;
  customerProfileId?: string;
  signature: string;
  statusCode: string;
  statusDescription: string;
}

export type FawryOrderStatus =
  | 'NEW'
  | 'PAID'
  | 'CANCELED'
  | 'REFUNDED'
  | 'EXPIRED'
  | 'PARTIAL_REFUNDED'
  | 'FAILED';

/**
 * Server Notification V2 — the authoritative payment-status callback Fawry
 * POSTs to our `/api/fawry/webhook`. Property names match the wire format
 * exactly, including Fawry's `paymentRefrenceNumber` typo.
 */
export interface FawryServerNotificationV2 {
  requestId: string;
  fawryRefNumber: string;
  merchantRefNumber: string;
  customerName?: string;
  customerMobile?: string;
  customerMail?: string;
  customerMerchantId?: string;
  // Amount fields are number-or-string on the wire. Fawry's webhook usually
  // sends numbers but some sandbox flows send strings. Normalise via
  // toFawryAmount before persisting so we obey the "no floats" rule from
  // CLAUDE.md §Money.
  paymentAmount: number | string;
  orderAmount: number | string;
  fawryFees?: number | string;
  shippingFees?: number | string;
  orderStatus: FawryOrderStatus;
  /** Wire form: 'PAYATFAWRY' | 'CARD' | 'MWALLET' | 'VALU' | etc. */
  paymentMethod: string;
  paymentTime?: number;
  authNumber?: string;
  /** [sic] — Fawry's spelling, do not normalise. */
  paymentRefrenceNumber?: string;
  orderExpiryDate?: number;
  orderItems?: unknown;
  failureErrorCode?: number;
  failureReason?: string;
  /** SHA-256 hex. See SIGNING_REFERENCE.md §3. */
  messageSignature: string;
  threeDSInfo?: Record<string, unknown>;
  invoiceInfo?: Record<string, unknown>;
  installmentInterestAmount?: number | string;
  installmentMonths?: number;
}

/** Subset of the response we expect from Fawry's refund endpoint. */
export interface FawryRefundRequest {
  merchantCode: string;
  referenceNumber: string;
  refundAmount: number;
  reason?: string;
  /** SHA-256 hex. See SIGNING_REFERENCE.md §4. */
  signature: string;
}
