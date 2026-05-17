/**
 * Translation between Fawry's `orderStatus` strings and our `payment_status`
 * enum. Lives outside the webhook route because slice 7's status-polling
 * reconciliation will need the same mapping.
 *
 * Returning `null` for NEW / PARTIAL_REFUNDED is deliberate — those don't
 * trigger a state transition for us. NEW just means "Fawry received the
 * intent"; PARTIAL_REFUNDED is a slice-10 concern (the order stays 'paid'
 * for the storefront, the partial-refund detail lives in payment_events).
 */
import type { FawryOrderStatus } from './types';

/** payment_status values that represent a terminal outcome of a charge. */
export type TerminalPaymentStatus = 'paid' | 'failed' | 'expired' | 'refunded';

export function mapFawryStatus(
  s: FawryOrderStatus
): TerminalPaymentStatus | null {
  switch (s) {
    case 'PAID':
      return 'paid';
    case 'FAILED':
    case 'CANCELED':
      return 'failed';
    case 'EXPIRED':
      return 'expired';
    case 'REFUNDED':
      return 'refunded';
    case 'NEW':
    case 'PARTIAL_REFUNDED':
      return null;
  }
}

/**
 * Fawry statuses that should cause an order in `pending` workflow status to
 * flip to `cancelled` — which triggers the migration-015 reservation release.
 * Late failures on already-progressed orders are left to manual support.
 */
export function isFailureBranch(s: FawryOrderStatus): boolean {
  return s === 'FAILED' || s === 'EXPIRED' || s === 'CANCELED';
}
