'use client';

import { useState, useTransition } from 'react';
import { savePromoCode } from '@/lib/admin/promo-actions';

interface Props {
  initial?: {
    id: string;
    code: string;
    discount_type: 'percentage' | 'flat';
    discount_value: number;
    valid_from: string | null;
    valid_to: string | null;
    usage_limit: number | null;
    is_active: boolean;
  };
}

function toLocalDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toISOString().slice(0, 16);
}

export default function PromoForm({ initial }: Props) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await savePromoCode(fd);
          if (res?.error) setErr(res.error);
        });
      }}
      className="space-y-5 max-w-2xl"
    >
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      {err && <div className="bg-danger/10 text-danger p-3 rounded-s text-sm">{err}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">الكود *</label>
          <input
            name="code"
            required
            defaultValue={initial?.code ?? ''}
            placeholder="مثل: SUMMER2026"
            dir="ltr"
            className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-mono uppercase"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">نوع الخصم *</label>
          <select
            name="discount_type"
            defaultValue={initial?.discount_type ?? 'percentage'}
            className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary bg-white"
          >
            <option value="percentage">نسبة %</option>
            <option value="flat">مبلغ ثابت بالجنيه</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">قيمة الخصم *</label>
        <input
          name="discount_value"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={initial?.discount_value ?? ''}
          className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">يبدأ من</label>
          <input
            name="valid_from"
            type="datetime-local"
            defaultValue={toLocalDateInput(initial?.valid_from ?? null)}
            className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">ينتهي في</label>
          <input
            name="valid_to"
            type="datetime-local"
            defaultValue={toLocalDateInput(initial?.valid_to ?? null)}
            className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">حد الاستخدام (اختياري)</label>
        <input
          name="usage_limit"
          type="number"
          min="1"
          defaultValue={initial?.usage_limit ?? ''}
          placeholder="مثل: 100 (أو اتركه فارغًا للاستخدام بلا حدود)"
          className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input name="is_active" type="checkbox" defaultChecked={initial?.is_active ?? true} className="w-4 h-4" />
        مُفعّل
      </label>

      <button type="submit" disabled={busy} className="btn btn-primary px-10 py-3 disabled:opacity-50">
        {busy ? 'جاري الحفظ...' : 'حفظ'}
      </button>
    </form>
  );
}
