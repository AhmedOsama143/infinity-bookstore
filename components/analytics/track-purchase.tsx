'use client';

import { useEffect } from 'react';
import { trackPurchase, type PurchasePayload } from '@/lib/analytics/gtm';

// Fires GA4 `purchase` exactly once per order from the result page. We use
// sessionStorage as the idempotency key because customers commonly refresh
// the result page while waiting for the webhook to land — without the gate
// we'd double-count revenue.

export default function TrackPurchase({ payload }: { payload: PurchasePayload }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `purchase_fired:${payload.transactionId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Private mode / blocked storage: still fire (better double than miss).
    }
    trackPurchase(payload);
  }, [payload]);
  return null;
}
