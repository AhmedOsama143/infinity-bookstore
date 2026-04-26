'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveReturn, rejectReturn, markReturnReceived } from '@/lib/admin/return-actions';
import { formatPrice } from '@/lib/utils';

const statusLabel: Record<string, { label: string; cls: string }> = {
  requested: { label: 'تم الطلب', cls: 'bg-primary-light text-primary-dark' },
  approved: { label: 'موافقة', cls: 'bg-accent text-white' },
  received: { label: 'تم الاستلام', cls: 'bg-primary text-white' },
  refunded: { label: 'تم الاسترداد', cls: 'bg-success text-white' },
  rejected: { label: 'رفض', cls: 'bg-danger text-white' },
};

export default function ReturnRow({ ret }: { ret: any }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const items = (ret.items ?? []) as any[];
  const fullValue = items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);

  async function handle(fn: () => Promise<{ error?: string }>) {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setErr(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <Link href={`/admin/orders/${ret.order_id}`} className="font-extrabold text-primary text-lg hover:text-primary-dark">
            {ret.order?.order_number ?? ret.order_id}
          </Link>
          <div className="text-xs text-[#666] mt-1">
            {ret.order?.student?.full_name ?? '—'} • {ret.order?.branch?.name_ar ?? '—'} •{' '}
            {new Date(ret.requested_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </div>
        <span className={`${statusLabel[ret.status]?.cls ?? ''} px-3 py-1 rounded-pill text-xs font-bold`}>
          {statusLabel[ret.status]?.label ?? ret.status}
        </span>
      </div>

      <div className="bg-bg-light rounded-s p-3 mb-4 text-sm">
        <strong className="block mb-1 text-[#666] text-xs">سبب الإرجاع:</strong>
        {ret.reason}
      </div>

      <ul className="text-sm space-y-1 mb-4 border-t border-bg-light pt-3">
        {items.map((it, i) => (
          <li key={i} className="flex justify-between">
            <span>{it.title_ar} × {it.quantity}</span>
            <span className="font-bold">{formatPrice(it.quantity * Number(it.unit_price))}</span>
          </li>
        ))}
        <li className="flex justify-between pt-2 mt-2 border-t border-bg-light font-extrabold text-accent-dark">
          <span>المجموع</span>
          <span>{formatPrice(fullValue)}</span>
        </li>
      </ul>

      {err && <div className="bg-danger/10 text-danger text-sm p-2 rounded-s mb-3">{err}</div>}

      {ret.status === 'requested' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => handle(() => approveReturn(ret.id, fullValue))}
            className="btn btn-primary px-5 py-2 text-sm disabled:opacity-50"
          >
            موافقة (استرداد {formatPrice(fullValue)})
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handle(() => rejectReturn(ret.id))}
            className="btn border-2 border-danger text-danger px-5 py-2 rounded-pill text-sm font-bold hover:bg-danger hover:text-white disabled:opacity-50"
          >
            رفض
          </button>
        </div>
      )}

      {ret.status === 'approved' && (
        <div>
          <p className="text-xs text-[#666] mb-2">عند استلام الكتب من الطالب، اضغط لاسترجاع المخزون وإغلاق الطلب:</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => handle(() => markReturnReceived(ret.id))}
            className="btn btn-primary px-5 py-2 text-sm disabled:opacity-50"
          >
            تم استلام الكتب — استرجاع المخزون
          </button>
        </div>
      )}
    </div>
  );
}
