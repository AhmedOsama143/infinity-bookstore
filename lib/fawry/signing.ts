/**
 * Fawry SHA-256 signature helpers — the load-bearing crypto for the whole
 * integration. Wrong field order on any of these silently breaks every
 * request: Fawry rejects with no useful error message.
 *
 * Formulas: see `docs/fawry/SIGNING_REFERENCE.md`. Update both files together.
 *
 * Server-side only. Imports `node:crypto`; do not import from a client
 * component — this module reads/uses the FAWRY_SECURE_KEY indirectly through
 * its callers.
 */
import { createHash } from 'node:crypto';
import type {
  FawryChargeItem,
  FawryChargeRequest,
  FawryRefundRequest,
  FawryServerNotificationV2,
} from './types';

/**
 * Format a Fawry-style two-decimal amount for signature input and DB storage.
 *
 * Accepts number OR string because Fawry's wire format is inconsistent:
 * charge responses are always strings, webhooks are usually numbers, and
 * older sandbox payloads sometimes mix them. Normalising here keeps the
 * "no floats anywhere for money" rule from CLAUDE.md while still working
 * with whatever shape Fawry sends.
 */
export function toFawryAmount(n: number | string): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) {
    throw new TypeError(`toFawryAmount: not a finite number: ${n}`);
  }
  return num.toFixed(2);
}

/** Optional-string concatenation: undefined/null become "". */
function or(s: string | null | undefined): string {
  return s ?? '';
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Case-insensitive hex compare. Fawry doesn't guarantee case on returned signatures. */
function hexEquals(a: string, b: string): boolean {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

// ============================================================================
// 1. Charge request — signed by us, sent via the JS plugin.
//    See SIGNING_REFERENCE.md §1.
// ============================================================================

export interface SignChargeRequestInput {
  merchantCode: string;
  merchantRefNum: string;
  customerProfileId?: string;
  returnUrl: string;
  chargeItems: FawryChargeItem[];
}

export function signChargeRequest(
  input: SignChargeRequestInput,
  secureKey: string
): string {
  // Sort items by itemId lexicographically. The cart UI may store items in
  // arbitrary order; the signature is computed over a canonical ordering so
  // both sides agree.
  const sortedItems = [...input.chargeItems].sort((a, b) =>
    a.itemId.localeCompare(b.itemId)
  );

  const itemsConcat = sortedItems
    .map((i) => `${i.itemId}${i.quantity}${toFawryAmount(i.price)}`)
    .join('');

  const raw =
    input.merchantCode +
    input.merchantRefNum +
    or(input.customerProfileId) +
    input.returnUrl +
    itemsConcat +
    secureKey;

  return sha256Hex(raw);
}

/**
 * Convenience: build a fully-signed FawryChargeRequest given an unsigned one.
 * The unsigned input must already contain everything the JS plugin needs;
 * this only computes the signature.
 */
export function attachChargeSignature(
  req: Omit<FawryChargeRequest, 'signature'>,
  secureKey: string
): FawryChargeRequest {
  const signature = signChargeRequest(
    {
      merchantCode: req.merchantCode,
      merchantRefNum: req.merchantRefNum,
      customerProfileId: req.customerProfileId,
      returnUrl: req.returnUrl,
      chargeItems: req.chargeItems,
    },
    secureKey
  );
  return { ...req, signature };
}

// ============================================================================
// 2. Charge response — verified on the browser-redirect return URL.
//    See SIGNING_REFERENCE.md §2.
// ============================================================================

export interface ChargeResponseParams {
  referenceNumber?: string;
  merchantRefNumber: string;
  paymentAmount: string | number;
  orderAmount: string | number;
  orderStatus: string;
  paymentMethod: string;
  fawryFees?: string | number;
  shippingFees?: string | number;
  authNumber?: string;
  customerMail?: string;
  customerMobile?: string;
  signature: string;
}

function maybeAmount(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '';
  return toFawryAmount(n);
}

export function verifyChargeResponse(
  params: ChargeResponseParams,
  secureKey: string
): boolean {
  const raw =
    or(params.referenceNumber) +
    params.merchantRefNumber +
    maybeAmount(params.paymentAmount) +
    maybeAmount(params.orderAmount) +
    params.orderStatus +
    params.paymentMethod +
    maybeAmount(params.fawryFees) +
    maybeAmount(params.shippingFees) +
    or(params.authNumber) +
    or(params.customerMail) +
    or(params.customerMobile) +
    secureKey;
  return hexEquals(sha256Hex(raw), params.signature);
}

// ============================================================================
// 3. Server Notification V2 (webhook) — verified on /api/fawry/webhook.
//    See SIGNING_REFERENCE.md §3.
// ============================================================================

export function verifyCallback(
  n: FawryServerNotificationV2,
  secureKey: string
): boolean {
  const raw =
    n.fawryRefNumber +
    n.merchantRefNumber +
    toFawryAmount(n.paymentAmount) +
    toFawryAmount(n.orderAmount) +
    n.orderStatus +
    n.paymentMethod +
    or(n.paymentRefrenceNumber) +
    secureKey;
  return hexEquals(sha256Hex(raw), n.messageSignature);
}

// ============================================================================
// 4. Status query — signed by us, sent to Fawry's GET /payments/status/v2.
//    See SIGNING_REFERENCE.md §4.
// ============================================================================

export interface SignStatusRequestInput {
  merchantCode: string;
  merchantRefNumber: string;
}

export function signStatusRequest(
  input: SignStatusRequestInput,
  secureKey: string
): string {
  const raw = input.merchantCode + input.merchantRefNumber + secureKey;
  return sha256Hex(raw);
}

// ============================================================================
// 5. Refund — signed by us, sent to Fawry's server-to-server refund API.
//    See SIGNING_REFERENCE.md §5.
// ============================================================================

export interface SignRefundInput {
  merchantCode: string;
  fawryRefNumber: string;
  refundAmount: number;
  reason?: string;
}

export function signRefund(input: SignRefundInput, secureKey: string): string {
  const raw =
    input.merchantCode +
    input.fawryRefNumber +
    toFawryAmount(input.refundAmount) +
    or(input.reason) +
    secureKey;
  return sha256Hex(raw);
}

export function attachRefundSignature(
  req: Omit<FawryRefundRequest, 'signature'>,
  secureKey: string
): FawryRefundRequest {
  const signature = signRefund(
    {
      merchantCode: req.merchantCode,
      fawryRefNumber: req.referenceNumber,
      refundAmount: req.refundAmount,
      reason: req.reason,
    },
    secureKey
  );
  return { ...req, signature };
}
