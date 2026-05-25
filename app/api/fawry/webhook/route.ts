/**
 * POST /api/fawry/webhook — Fawry Server Notification V2 receiver.
 *
 * Slice 5 of the integration. This endpoint is the *only* authoritative source
 * for marking an order paid, failed, or expired. The browser-redirect to
 * /checkout/result is for UX only.
 *
 * Contract:
 *   • Public (no auth) but signature-verified with FAWRY_SECURE_KEY.
 *   • Always returns 200, even on signature failure or unknown order —
 *     anything else triggers Fawry retry storms that don't help us.
 *   • Insert into payment_events FIRST so an audit trail survives any
 *     downstream failure. Idempotency is enforced by the partial unique index
 *     uq_payment_events_webhook_idem from migration 019: a retry with the
 *     same (merchant_ref_number, orderStatus) and a valid signature raises
 *     23505, which we treat as "already seen, ack and exit".
 *
 * Status mapping:
 *   PAID                     → payment_status='paid'  (order.status left alone)
 *   FAILED / EXPIRED / CANCELED → payment_status='failed' | 'expired'
 *                              AND order.status='cancelled' if still pending,
 *                              which trips the migration-015 trigger to
 *                              release branch stock back to inventory.
 *   REFUNDED                 → payment_status='refunded' (slice 10 owns the
 *                              staff-initiated refund flow; this only handles
 *                              webhook-reported refunds for audit symmetry).
 *   NEW / PARTIAL_REFUNDED   → logged, no order mutation.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { toFawryAmount, verifyCallback } from '@/lib/fawry/signing';
import { getFawryConfig } from '@/lib/fawry/config';
import { mapFawryStatus, isFailureBranch } from '@/lib/fawry/status';
import { logFunnelEvent } from '@/lib/analytics/server';
import { log } from '@/lib/log';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { KNOWN_PAYMENT_METHODS, type FawryServerNotificationV2 } from '@/lib/fawry/types';

// z.union of number and string for any field that Fawry sometimes serialises
// as a string and sometimes as a number (every amount field falls in this
// bucket — see CLAUDE.md §Money).
const FawryAmount = z.union([z.number(), z.string()]);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Minimal shape validation. We only enforce the fields the signature/business
// logic actually reads — anything else passes through into raw_payload so the
// audit row stays faithful to what Fawry sent us.
const NotificationSchema = z
  .object({
    requestId: z.string(),
    fawryRefNumber: z.string().min(1),
    merchantRefNumber: z.string().min(1),
    paymentAmount: FawryAmount,
    orderAmount: FawryAmount,
    fawryFees: FawryAmount.optional(),
    shippingFees: FawryAmount.optional(),
    orderStatus: z.enum([
      'NEW',
      'PAID',
      'CANCELED',
      'REFUNDED',
      'EXPIRED',
      'PARTIAL_REFUNDED',
      'FAILED',
    ]),
    paymentMethod: z.string().min(1),
    paymentTime: z.number().optional(),
    paymentRefrenceNumber: z.string().optional(),
    messageSignature: z.string().min(1),
  })
  .passthrough();

function ok() {
  // Plain 200 — Fawry only cares that it's not a retry-trigger response.
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  // 0. Rate limit per source IP. Genuine Fawry traffic for one merchant is
  //    well under 1 webhook/sec; 60/min is generous. Block by IP rather
  //    than by ref so attacker spam doesn't burn budget for legit retries
  //    on a delayed webhook. Fails open if Upstash isn't configured.
  const ip = clientIp(request.headers);
  const rate = await checkRateLimit('fawry-webhook', ip, 60, 60);
  if (!rate.allowed) {
    log.warn('fawry/webhook', 'rate_limited', { ip, resetAt: rate.resetAt });
    // 429, not 200 — Fawry SHOULD retry on transient failure, so the limit
    // doesn't drop legit retries permanently.
    return NextResponse.json(
      { ok: false, error: { code: 'rate_limited' } },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  // 1. Parse. Any failure here is logged to stderr — we can't even write an
  //    audit row without a merchant_ref_number, so the best we can do is ack.
  let parsedRaw: unknown;
  try {
    parsedRaw = await request.json();
  } catch {
    log.error('fawry/webhook', 'invalid_json');
    return ok();
  }

  const parsed = NotificationSchema.safeParse(parsedRaw);
  if (!parsed.success) {
    log.error('fawry/webhook', 'schema_invalid', {
      issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })),
    });
    return ok();
  }
  const notif = parsed.data as FawryServerNotificationV2;

  let config;
  try {
    config = getFawryConfig();
  } catch (err) {
    log.error('fawry/webhook', 'config_missing', {
      message: err instanceof Error ? err.message : String(err),
    });
    return ok();
  }

  const signatureValid = verifyCallback(notif, config.secureKey);
  const admin = createAdminClient();

  // 2. Audit row. For invalid sigs the partial unique index doesn't fire, so
  //    every bad attempt is recorded distinctly. For valid sigs the index
  //    enforces (merchant_ref_number, orderStatus) uniqueness — a retry of an
  //    already-processed webhook collides on 23505 and we exit early.
  const insertEvent = await admin
    .from('payment_events')
    .insert({
      merchant_ref_number: notif.merchantRefNumber,
      event_type: 'webhook',
      raw_payload: notif,
      signature_provided: notif.messageSignature,
      signature_valid: signatureValid,
      fawry_status_code: notif.orderStatus,
      processed: false,
    })
    .select('id')
    .single();

  if (insertEvent.error) {
    if (insertEvent.error.code === '23505') {
      // Already processed (or processing) a webhook for this (ref, status).
      // Fawry retried — ack and move on.
      return ok();
    }
    log.error('fawry/webhook', 'audit_insert_failed', {
      merchantRefNumber: notif.merchantRefNumber,
      code: insertEvent.error.code,
      message: insertEvent.error.message,
    });
    return ok();
  }

  const eventId = insertEvent.data.id;

  // 3. Reject invalid signatures AFTER logging them.
  if (!signatureValid) {
    return ok();
  }

  // 4. Look up the order. Service-role read so RLS doesn't get in the way.
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, status, payment_status, payment_method, student_id, total')
    .eq('merchant_ref_number', notif.merchantRefNumber)
    .maybeSingle();

  if (orderErr) {
    await admin
      .from('payment_events')
      .update({ error_message: `order_lookup_failed: ${orderErr.message}` })
      .eq('id', eventId);
    return ok();
  }

  if (!order) {
    // Unknown merchantRefNumber — could be a stale sandbox order, a mistakenly
    // pointed webhook from another environment, or a test ping. Log and ack.
    await admin
      .from('payment_events')
      .update({ error_message: 'order_not_found' })
      .eq('id', eventId);
    return ok();
  }

  // 4a. P0-2: defence-in-depth against environment/webhook misconfiguration.
  //     If a non-Fawry order (COD) ever shows up here, we refuse to touch it.
  //     UUID collisions are vanishingly unlikely, but a stray webhook from a
  //     different environment pointed at our dashboard could otherwise mark a
  //     cash order paid.
  if (order.payment_method !== 'fawry') {
    await admin
      .from('payment_events')
      .update({
        order_id: order.id,
        error_message: `not_fawry_order:${order.payment_method}`,
      })
      .eq('id', eventId);
    return ok();
  }

  // 5. Map Fawry status to our payment_status. Some statuses (NEW,
  //    PARTIAL_REFUNDED) don't drive a state transition — we still mark the
  //    audit row processed so reconciliation jobs don't pick it up later.
  const targetStatus = mapFawryStatus(notif.orderStatus);
  if (targetStatus === null) {
    await admin
      .from('payment_events')
      .update({
        order_id: order.id,
        processed: true,
        error_message: `no_transition_for:${notif.orderStatus}`,
      })
      .eq('id', eventId);
    return ok();
  }

  // 6. Order-level idempotency: if the order is already where the webhook
  //    wants to put it, this is a same-status retry that slipped past the
  //    unique index (e.g. the signature differed because Fawry re-sent with
  //    different optional fields). Treat as no-op.
  if (order.payment_status === targetStatus) {
    await admin
      .from('payment_events')
      .update({ order_id: order.id, processed: true })
      .eq('id', eventId);
    return ok();
  }

  // 6a. P0-1: amount sanity check before the PAID transition. The signature
  //     proves Fawry sent the payload, but it doesn't prove the customer paid
  //     the right amount — a webhook replay against a re-priced order, or a
  //     Fawry-side bug, could mark us paid for less than we computed. On
  //     mismatch we log and bail (no flip), and surface to staff via the
  //     payment_events audit row.
  if (notif.orderStatus === 'PAID') {
    const expected = toFawryAmount(Number(order.total));
    const received = toFawryAmount(notif.orderAmount);
    if (expected !== received) {
      await admin
        .from('payment_events')
        .update({
          order_id: order.id,
          error_message: `amount_mismatch: expected=${expected} received=${received}`,
        })
        .eq('id', eventId);
      return ok();
    }
  }

  // 6b. P0-3: staff may have cancelled the order in the dashboard before
  //     Fawry's PAID webhook arrived (common with kiosk references that can
  //     take hours). Flipping payment_status=paid on a cancelled order leaves
  //     us in an inconsistent state — stock released, but the customer shows
  //     as paid. Refuse, log, escalate to support (likely a refund).
  if (notif.orderStatus === 'PAID' && order.status === 'cancelled') {
    await admin
      .from('payment_events')
      .update({
        order_id: order.id,
        error_message: 'paid_after_cancel',
      })
      .eq('id', eventId);
    return ok();
  }

  // 7. Build the update. Money fields are normalised through toFawryAmount
  //    so the row holds the canonical two-decimal string, matching the
  //    DECIMAL column and the "no floats" rule (CLAUDE.md §Money).
  const knownMethod = KNOWN_PAYMENT_METHODS.has(notif.paymentMethod);
  const update: Record<string, unknown> = {
    payment_status: targetStatus,
    payment_method_detail: knownMethod ? notif.paymentMethod : null,
    fawry_ref_number: notif.fawryRefNumber,
    fawry_fees: notif.fawryFees != null ? toFawryAmount(notif.fawryFees) : '0.00',
    payment_amount: toFawryAmount(notif.paymentAmount),
  };

  // P2-4: stash unrecognised payment methods on the audit row so the value
  // isn't silently dropped — staff can spot a new Fawry method that needs
  // adding to KNOWN_PAYMENT_METHODS.
  if (!knownMethod) {
    await admin
      .from('payment_events')
      .update({ error_message: `unknown_payment_method:${notif.paymentMethod}` })
      .eq('id', eventId);
  }

  if (notif.orderStatus === 'PAID') {
    update.payment_paid_at = notif.paymentTime
      ? new Date(notif.paymentTime).toISOString()
      : new Date().toISOString();
  }

  // Failure modes flip order.status='cancelled', which is what the
  // migration-015/018 trigger watches to release the branch reservation.
  // Only cancel if the order is still pending; once staff have advanced it
  // (confirmed/ready/completed), a late Fawry "FAILED" shouldn't yank the
  // workflow out from under them — that's a manual support case.
  if (isFailureBranch(notif.orderStatus) && order.status === 'pending') {
    update.status = 'cancelled';
  }

  // 8. Commit the order update. If this fails we keep the audit row with
  //    processed=false and an error_message so a reconciliation pass (slice 7)
  //    can replay it later.
  const { error: updateErr } = await admin
    .from('orders')
    .update(update)
    .eq('id', order.id);

  if (updateErr) {
    await admin
      .from('payment_events')
      .update({
        order_id: order.id,
        error_message: `order_update_failed: ${updateErr.message}`,
      })
      .eq('id', eventId);
    return ok();
  }

  // 9. Done. Mark the audit row processed so reconciliation skips it.
  await admin
    .from('payment_events')
    .update({ order_id: order.id, processed: true })
    .eq('id', eventId);

  // 10. Conversion log. Only fire on the PAID transition (already gated by
  //     the idempotency check at step 6 — a duplicate PAID webhook returns
  //     before reaching here). Funnel events are best-effort; never let an
  //     analytics failure break the webhook ACK.
  if (notif.orderStatus === 'PAID') {
    void logFunnelEvent(admin, {
      event: 'purchase',
      user_id: order.student_id ?? null,
      order_id: order.id,
      value: Number(notif.paymentAmount ?? order.total ?? 0),
      props: {
        payment_method: 'fawry',
        payment_method_detail: notif.paymentMethod,
        fawry_ref_number: notif.fawryRefNumber,
        fawry_fees: Number(notif.fawryFees ?? 0),
      },
    });
  }

  return ok();
}
