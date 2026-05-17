'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orderId: string;
  merchantRefNumber: string;
  fawryRefNumber: string | null;
  paymentStatus: string;
  paymentAmount: number;
  canRefund: boolean;
}

// Action sidebar on the admin payment detail page. Two operator actions:
//   1. Force a status poll against Fawry — useful when a customer says "I paid
//      but it shows pending" and the webhook never landed.
//   2. Refund (only when payment_status='paid') — flips the order to refunded
//      and tells Fawry to return the money.
//
// Both hit our own route handlers; we re-render the page on success so the
// timeline picks up the new payment_events row.

export default function PaymentActions({
  orderId,
  merchantRefNumber,
  fawryRefNumber,
  paymentStatus,
  paymentAmount,
  canRefund,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reconcileResult, setReconcileResult] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState(paymentAmount.toFixed(2));
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);

  async function doReconcile() {
    setReconcileResult(null);
    try {
      const res = await fetch(`/api/fawry/status/${encodeURIComponent(merchantRefNumber)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const body = await res.json();
      if (!body.ok) {
        setReconcileResult(`فشل: ${body.error?.message ?? 'خطأ غير معروف'}`);
        return;
      }
      const tag = body.data?.reason ?? 'تم';
      setReconcileResult(tag === 'in_sync' ? 'الحالة محدثة بالفعل' : `تم: ${tag}`);
      startTransition(() => router.refresh());
    } catch (err) {
      setReconcileResult(`فشل: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    }
  }

  async function doRefund(e: React.FormEvent) {
    e.preventDefault();
    setRefundError(null);
    setRefundSuccess(null);

    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError('أدخل مبلغًا صحيحًا أكبر من صفر.');
      return;
    }
    if (amount > paymentAmount + 0.01) {
      setRefundError('المبلغ المطلوب أكبر من المبلغ المدفوع.');
      return;
    }

    try {
      const res = await fetch('/api/fawry/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          refundAmount: amount,
          reason: refundReason.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!body.ok) {
        setRefundError(body.error?.message ?? 'فشل الاسترداد');
        return;
      }
      setRefundSuccess('تم إرسال طلب الاسترداد إلى فوري بنجاح.');
      setRefundOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'فشل الاسترداد');
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-bold mb-3 text-primary-dark">إجراءات</h2>

      <button
        type="button"
        onClick={doReconcile}
        disabled={pending}
        className="btn btn-outline w-full mb-2 text-sm"
      >
        <i className="fa-solid fa-rotate ml-1" />
        مزامنة مع فوري
      </button>
      <p className="text-xs text-[#666] leading-relaxed mb-4">
        يطلب من فوري آخر حالة معروفة لهذا الطلب ويُحدّث الحالة محليًا إذا كان هناك فرق.
      </p>
      {reconcileResult && (
        <div className="text-xs bg-bg-light rounded-s p-2 mb-4">{reconcileResult}</div>
      )}

      {canRefund && (
        <>
          <button
            type="button"
            onClick={() => setRefundOpen((v) => !v)}
            className="btn btn-primary w-full text-sm"
            disabled={!fawryRefNumber}
          >
            <i className="fa-solid fa-money-bill-transfer ml-1" />
            استرداد المبلغ
          </button>
          {!fawryRefNumber && (
            <p className="text-xs text-danger mt-2">
              لا يمكن الاسترداد قبل ورود الرقم المرجعي من فوري.
            </p>
          )}

          {refundOpen && (
            <form onSubmit={doRefund} className="mt-3 space-y-2 border-t border-bg-light pt-3">
              <label className="block text-xs font-bold">المبلغ</label>
              <input
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="input w-full"
                required
              />
              <label className="block text-xs font-bold">السبب (اختياري)</label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="input w-full"
                rows={2}
                maxLength={200}
              />
              {refundError && <div className="text-xs text-danger">{refundError}</div>}
              <button type="submit" disabled={pending} className="btn btn-primary w-full text-sm">
                {pending ? 'جارٍ الإرسال...' : 'تأكيد الاسترداد'}
              </button>
            </form>
          )}
        </>
      )}

      {refundSuccess && (
        <div className="text-xs bg-success/10 text-success rounded-s p-2 mt-3">{refundSuccess}</div>
      )}

      <div className="text-xs text-[#888] mt-4 pt-3 border-t border-bg-light leading-relaxed">
        حالة الدفع الحالية: <span className="font-bold">{paymentStatus}</span>
      </div>
    </div>
  );
}
