'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOrderPaymentStatus } from '@/lib/admin/order-actions';
import type { PaymentStatus } from '@/lib/types';

export default function PaymentStatusToggle({
  orderId,
  current,
}: {
  orderId: string;
  current: PaymentStatus;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const next: PaymentStatus = current === 'paid' ? 'pending' : 'paid';
  const label = current === 'paid' ? 'تحويل إلى غير مدفوع' : 'تأكيد الاستلام (مدفوع)';

  function toggle() {
    setError(null);
    start(async () => {
      const res = await setOrderPaymentStatus(orderId, next);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-4">
      {error && <div className="bg-danger/10 text-danger text-xs p-2 rounded-s mb-2">{error}</div>}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`btn w-full text-sm ${current === 'paid' ? 'btn-outline' : 'btn-primary'} disabled:opacity-50`}
      >
        {busy ? '...' : label}
      </button>
    </div>
  );
}
