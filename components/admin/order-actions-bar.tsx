'use client';
import { useEffect, useState, useTransition } from 'react';
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const router = useRouter();

  function go(to: OrderStatus) {
    setError(null);
    start(async () => {
      const res = await transitionOrder(orderId, to);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function openCancelModal() {
    setReason('');
    setError(null);
    setConfirmOpen(true);
  }

  function closeCancelModal() {
    if (busy) return;
    setConfirmOpen(false);
  }

  function confirmCancel() {
    const trimmed = reason.trim();
    start(async () => {
      const res = await transitionOrder(orderId, 'cancelled', trimmed || undefined);
      if (res.error) {
        setError(res.error);
        setConfirmOpen(false);
      } else {
        setConfirmOpen(false);
        router.refresh();
      }
    });
  }

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCancelModal();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [confirmOpen, busy]);

  const next = NEXT_BUTTONS[status];
  if (status === 'cancelled') return null;

  const isCompleted = status === 'completed';
  const cancelLabel = isCompleted ? 'إلغاء وإرجاع المخزون' : 'إلغاء الطلب';

  return (
    <>
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
          <button
            type="button"
            onClick={openCancelModal}
            disabled={busy}
            className="btn border-2 border-danger text-danger px-6 py-2 rounded-pill font-semibold hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-order-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm"
          onClick={closeCancelModal}
        >
          <div
            className="card w-full max-w-xl shadow-card-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 bg-primary-light">
              <h3 id="cancel-order-title" className="font-bold text-primary-dark flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-danger" />
                تأكيد إلغاء الطلب
              </h3>
              <button
                type="button"
                onClick={closeCancelModal}
                disabled={busy}
                aria-label="إغلاق"
                className="text-primary-dark/70 hover:text-primary-dark disabled:opacity-50"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-ink">
                {isCompleted
                  ? 'سيتم إلغاء هذا الطلب وإرجاع الكتب إلى مخزون الفرع. هل أنت متأكد؟'
                  : 'سيتم إلغاء هذا الطلب وتحرير المخزون المحجوز. هل أنت متأكد؟'}
              </p>

              <div>
                <label htmlFor="cancel-reason" className="block text-xs text-[#666] font-bold mb-2">
                  سبب الإلغاء (اختياري)
                </label>
                <textarea
                  id="cancel-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                  rows={3}
                  placeholder="مثال: العميل غيّر رأيه، خطأ في الكمية، إرجاع بعد الاستلام…"
                  className="w-full px-3 py-2 border border-bg-light rounded-s bg-white text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="bg-danger/10 text-danger text-sm p-3 rounded-s">{error}</div>
              )}
            </div>

            <div className="flex flex-wrap-reverse justify-end gap-3 p-5 bg-bg-light/50 border-t border-bg-light">
              <button
                type="button"
                onClick={closeCancelModal}
                disabled={busy}
                className="btn bg-white text-ink hover:bg-bg-light px-5 py-2 text-sm disabled:opacity-50"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={busy}
                className="btn bg-danger text-white hover:bg-danger/90 px-5 py-2 text-sm font-bold disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin ml-2" />
                    جاري الإلغاء…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check ml-2" />
                    تأكيد الإلغاء
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
