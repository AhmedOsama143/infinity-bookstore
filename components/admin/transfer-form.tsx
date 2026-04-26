'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTransfer } from '@/lib/admin/transfer-actions';

interface Props {
  branches: { id: string; name_ar: string }[];
  books: { id: number; title_ar: string }[];
}

export default function TransferForm({ branches, books }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await createTransfer(fd);
          if (res?.error) setMsg({ type: 'err', text: res.error });
          else {
            setMsg({ type: 'ok', text: '✓ تم النقل بنجاح' });
            (e.target as HTMLFormElement).reset();
            router.refresh();
          }
        });
      }}
      className="card p-5 space-y-4 max-w-2xl"
    >
      {msg && (
        <div className={`text-sm p-3 rounded-s border ${msg.type === 'ok' ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">من فرع *</label>
          <select name="from_branch" required className="w-full px-4 py-2.5 rounded-s border border-[#ddd] bg-white">
            <option value="">— اختر —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">إلى فرع *</label>
          <select name="to_branch" required className="w-full px-4 py-2.5 rounded-s border border-[#ddd] bg-white">
            <option value="">— اختر —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">الكتاب *</label>
        <select name="book_id" required className="w-full px-4 py-2.5 rounded-s border border-[#ddd] bg-white">
          <option value="">— اختر —</option>
          {books.map((b) => <option key={b.id} value={b.id}>#{b.id} — {b.title_ar}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">الكمية *</label>
        <input
          name="quantity"
          type="number"
          min="1"
          required
          className="w-32 px-4 py-2.5 rounded-s border border-[#ddd] focus:border-primary outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">ملاحظات</label>
        <textarea name="notes" rows={2} className="w-full px-4 py-2.5 rounded-s border border-[#ddd] resize-y" />
      </div>

      <button type="submit" disabled={busy} className="btn btn-primary px-8 py-2.5 disabled:opacity-50">
        {busy ? 'جاري النقل...' : 'نقل المخزون'}
      </button>
    </form>
  );
}
