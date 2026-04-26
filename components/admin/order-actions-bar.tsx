'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { transitionOrder } from '@/lib/admin/order-actions';
import type { OrderStatus } from '@/lib/types';

const NEXT_BUTTONS: Record<OrderStatus, { to: OrderStatus; label: string; cls: string }[]> = {
  pending:   [{ to: 'confirmed', label: 'تأكيد الطلب',  cls: 'btn-primary' }],
  confirmed: [{ to: 'ready',     label: 'جاهز للاستلام', cls: 'btn-primary' }],
  ready:     [{ to: 'completed', label: 'تم الاستلام',   cls: 'btn-primary' }],
  completed: [],
  cancelled: [],
};

export default function OrderActionsBar({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function go(to: OrderStatus) {
    setError(null);
    start(async () => {
      const res = await transitionOrder(orderId, to);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function cancel() {
    const reason = prompt('سبب الإلغاء (اختياري):');
    if (reason === null) return; // user cancelled the prompt
    setError(null);
    start(async () => {
      const res = await transitionOrder(orderId, 'cancelled', reason || undefined);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const next = NEXT_BUTTONS[status];
  if (next.length === 0 && status !== 'cancelled') return null;

  return (
    <div className="card p-5">
      {error && <div className="bg-danger/10 text-danger text-sm p-3 rounded-s mb-3">{error}</div>}
      <div className="flex flex-wrap gap-3">
        {next.map((b) => (
          <button
            key={b.to}
            type="button"
            onClick={() => go(b.to)}
            disabled={busy}
            className={`btn ${b.cls} disabled:opacity-50`}
          >
            {b.label}
            <i className="fa-solid fa-arrow-left mr-2" />
          </button>
        ))}
        {status !== 'completed' && status !== 'cancelled' && (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="btn border-2 border-danger text-danger px-6 py-2 rounded-pill font-semibold hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
          >
            إلغاء الطلب
          </button>
        )}
      </div>
    </div>
  );
}
