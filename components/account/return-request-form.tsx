'use client';

import { useState, useTransition } from 'react';
import { requestReturn } from '@/lib/cart/return-request';

export default function ReturnRequestForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set('order_id', orderId);
    start(async () => {
      const res = await requestReturn(fd);
      if (res.error) setMsg({ type: 'err', text: res.error });
      else {
        setMsg({ type: 'ok', text: 'تم استلام طلب الإرجاع. سنتواصل معك قريبًا.' });
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-danger hover:text-danger/70 underline"
      >
        طلب إرجاع
      </button>
    );
  }

  return (
    <div className="mt-3 card p-4 bg-bg-light">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm font-semibold">سبب الإرجاع</label>
        <textarea
          name="reason"
          required
          rows={3}
          placeholder="مثل: استلمت طبعة قديمة / كتاب تالف / لا أحتاجه..."
          className="w-full px-3 py-2 rounded-s border border-[#ddd] focus:border-primary outline-none text-sm"
        />
        {msg && (
          <div className={`text-sm p-2 rounded-s ${msg.type === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {msg.text}
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn btn-primary text-sm py-1.5 px-4 disabled:opacity-50">
            {busy ? 'جاري الإرسال...' : 'إرسال الطلب'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-outline text-sm py-1.5 px-4">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
