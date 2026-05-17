/**
 * Order ↔ Fawry reconciliation. Calls Fawry's status API for a given order
 * and, if Fawry reports a terminal state our DB is missing, applies the
 * transition with the same guards as the webhook handler.
 *
 * Used by:
 *   • Slice 7 — result-page poll fallback (server action in result-actions.ts)
 *   • Slice 7 — admin / direct callers via GET /api/fawry/status/[ref]
 *   • Slice 8 — stock cleanup cron, which polls before cancelling
 *
 * Server-side only — imports getFawryConfig and the service-role client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPaymentStatus, type FawryStatusResponse } from './client';
import { getFawryConfig } from './config';
import { toFawryAmount } from './signing';
import { isFailureBranch, mapFawryStatus } from './status';
import type { FawryOrderStatus } from './types';

export interface ReconcileResult {
  orderId: string;
  payment_status: string;
  status: string;
  fawry_status: FawryOrderStatus | null;
  payment_method_detail: string | null;
  fawry_ref_number: string | null;
  reconciled: boolean;
  /** Machine-readable outcome tag — e.g. 'in_sync', 'reconciled_paid', 'amount_mismatch:200_vs_180'. */
  reason: string;
}

interface OrderRow {
  id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  payment_method_detail: string | null;
  fawry_ref_number: string | null;
  total: number | string | null;
}

export async function reconcileOrderWithFawry(
  admin: SupabaseClient,
  merchantRefNumber: string,
  order: OrderRow
): Promise<ReconcileResult> {
  let fawryStatus: FawryStatusResponse | null = null;
  let pollError: string | null = null;
  try {
    fawryStatus = await fetchPaymentStatus(merchantRefNumber, getFawryConfig());
  } catch (err) {
    pollError = err instanceof Error ? err.message : String(err);
  }

  await admin.from('payment_events').insert({
    merchant_ref_number: merchantRefNumber,
    order_id: order.id,
    event_type: 'status_poll',
    raw_payload: fawryStatus ?? { error: pollError },
    signature_valid: true,
    fawry_status_code: fawryStatus?.orderStatus ?? null,
    processed: true,
    error_message: pollError ?? null,
  });

  if (!fawryStatus) {
    return {
      orderId: order.id,
      payment_status: order.payment_status,
      status: order.status,
      fawry_status: null,
      payment_method_detail: order.payment_method_detail,
      fawry_ref_number: order.fawry_ref_number,
      reconciled: false,
      reason: `fawry_unreachable:${pollError ?? 'unknown'}`,
    };
  }

  const fawryOrderStatus = (fawryStatus.orderStatus ?? null) as FawryOrderStatus | null;
  const targetStatus = fawryOrderStatus ? mapFawryStatus(fawryOrderStatus) : null;

  let reconciled = false;
  let reason = 'in_sync';

  if (
    targetStatus &&
    fawryOrderStatus &&
    order.payment_status !== targetStatus &&
    order.payment_status === 'pending'
  ) {
    if (fawryOrderStatus === 'PAID') {
      const expected = toFawryAmount(Number(order.total ?? 0));
      const received =
        fawryStatus.orderAmount != null ? toFawryAmount(fawryStatus.orderAmount) : null;
      if (received && expected !== received) {
        reason = `amount_mismatch:${expected}_vs_${received}`;
      } else if (order.status === 'cancelled') {
        reason = 'paid_after_cancel';
      } else {
        const update: Record<string, unknown> = {
          payment_status: 'paid',
          fawry_ref_number: fawryStatus.fawryRefNumber ?? order.fawry_ref_number,
          payment_amount:
            fawryStatus.paymentAmount != null
              ? toFawryAmount(fawryStatus.paymentAmount)
              : toFawryAmount(Number(order.total ?? 0)),
          fawry_fees:
            fawryStatus.fawryFees != null ? toFawryAmount(fawryStatus.fawryFees) : '0.00',
          payment_paid_at: fawryStatus.paymentTime
            ? new Date(fawryStatus.paymentTime).toISOString()
            : new Date().toISOString(),
        };
        if (fawryStatus.paymentMethod) update.payment_method_detail = fawryStatus.paymentMethod;
        await admin.from('orders').update(update).eq('id', order.id);
        reconciled = true;
        reason = 'reconciled_paid';
      }
    } else if (isFailureBranch(fawryOrderStatus)) {
      const update: Record<string, unknown> = { payment_status: targetStatus };
      if (order.status === 'pending') update.status = 'cancelled';
      await admin.from('orders').update(update).eq('id', order.id);
      reconciled = true;
      reason = `reconciled_${targetStatus}`;
    }
  }

  // Re-read so the snapshot reflects any reconciliation.
  const { data: latest } = await admin
    .from('orders')
    .select('payment_status, status, payment_method_detail, fawry_ref_number')
    .eq('id', order.id)
    .single();

  return {
    orderId: order.id,
    payment_status: latest?.payment_status ?? order.payment_status,
    status: latest?.status ?? order.status,
    fawry_status: fawryOrderStatus,
    payment_method_detail: latest?.payment_method_detail ?? order.payment_method_detail,
    fawry_ref_number: latest?.fawry_ref_number ?? order.fawry_ref_number,
    reconciled,
    reason,
  };
}
