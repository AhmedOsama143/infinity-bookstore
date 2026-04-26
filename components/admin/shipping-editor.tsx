'use client';
import { useTransition, useState } from 'react';
import { updateShippingRate, updateFreeShippingThreshold } from '@/lib/admin/shipping-actions';

interface Rate {
  id: string;
  area_type: string;
  governorate_ar: string;
  price: number;
}

const labels: Record<string, string> = {
  alexandria_city: 'الإسكندرية (داخل المدينة)',
  alexandria_outskirts: 'ضواحي الإسكندرية',
  kafr_el_dawwar: 'كفر الدوار',
  other_governorate: 'محافظات أخرى',
};

export default function ShippingEditor({
  rates,
  threshold,
  enabled,
}: { rates: Rate[]; threshold: number; enabled: boolean }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function saveRate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateShippingRate(data);
      setMsg(res?.error ?? '✓ تم الحفظ');
    });
  }

  function saveThreshold(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateFreeShippingThreshold(data);
      setMsg(res?.error ?? '✓ تم تحديث الحد الأدنى');
    });
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`text-sm p-3 rounded-s border ${msg.startsWith('✓') ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
          {msg}
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-bold text-primary-dark mb-4 text-lg">الحد الأدنى للشحن المجاني</h2>
        <form onSubmit={saveThreshold} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-[#666] mb-1">قيمة الطلب (جنيه)</label>
            <input
              name="threshold"
              type="number"
              min="0"
              step="50"
              defaultValue={threshold}
              className="w-40 px-4 py-2 rounded-s border border-[#ddd] focus:border-primary outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="enabled" type="checkbox" defaultChecked={enabled} className="w-4 h-4" />
            مُفعّل
          </label>
          <button type="submit" disabled={busy} className="btn btn-primary px-6 disabled:opacity-50">
            حفظ
          </button>
        </form>
        <p className="text-xs text-[#666] mt-3">
          الطلبات التي يتجاوز إجماليها هذا الحد تحصل على شحن مجاني تلقائيًا. التغيير يظهر فورًا في كل أنحاء الموقع.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-bold text-primary-dark mb-4 text-lg">أسعار الشحن لكل منطقة</h2>
        <div className="space-y-3">
          {rates.map((r) => (
            <form key={r.id} onSubmit={saveRate} className="flex items-center gap-4 border-b border-bg-light pb-3 last:border-0">
              <input type="hidden" name="id" value={r.id} />
              <div className="flex-1">
                <div className="font-bold">{labels[r.area_type] ?? r.area_type}</div>
                <div className="text-xs text-[#666]">{r.governorate_ar}</div>
              </div>
              <input
                name="price"
                type="number"
                min="0"
                step="5"
                defaultValue={r.price}
                className="w-28 px-3 py-1.5 rounded-s border border-[#ddd] focus:border-primary outline-none text-center"
              />
              <span className="text-sm text-[#666]">جنيه</span>
              <button type="submit" disabled={busy} className="btn btn-primary px-5 py-1.5 text-sm disabled:opacity-50">
                حفظ
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
