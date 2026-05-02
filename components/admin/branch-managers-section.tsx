'use client';
import { useState, useTransition } from 'react';
import { inviteBranchManager, removeBranchManager, type InviteResult } from '@/lib/admin/settings-actions';

interface Branch { id: string; name_ar: string }
interface Manager {
  id: string;
  email: string | null;
  branch_id: string | null;
  branch?: { name_ar: string };
  mfa_enabled: boolean;
  created_at: string;
}

export default function BranchManagersSection({
  branches,
  managers,
}: {
  branches: Branch[];
  managers: Manager[];
}) {
  const [result, setResult] = useState<InviteResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card p-6 space-y-4">
      <div className="border-b border-bg-light pb-3">
        <h2 className="text-lg font-bold text-primary-dark">مديرو الفروع</h2>
        <p className="text-xs text-[#666]">
          حسابات بصلاحيات قراءة فقط على فرع واحد + استلام الطلبات
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setResult(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await inviteBranchManager(fd);
            setResult(res);
            if (res.ok) (e.target as HTMLFormElement).reset();
          });
        }}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            name="email"
            type="email"
            required
            placeholder="manager@example.com"
            dir="ltr"
            className="px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
          />
          <select
            name="branch_id"
            required
            defaultValue=""
            className="px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary bg-white"
          >
            <option value="" disabled>اختر الفرع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name_ar}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={isPending} className="btn btn-primary text-sm disabled:opacity-50">
          <i className="fa-solid fa-user-plus ml-2" />
          {isPending ? 'جاري الإنشاء...' : 'دعوة مدير فرع'}
        </button>
      </form>

      {result?.error && (
        <div className="text-sm p-3 rounded-s bg-danger/10 text-danger border border-danger/20">
          {result.error}
        </div>
      )}

      {result?.ok && (
        <div className="text-sm p-4 rounded-s bg-success/10 border border-success/20 space-y-2">
          <p className="font-bold text-success">تم إنشاء الحساب بنجاح</p>
          <p>أرسل هذه البيانات لمدير الفرع — يجب تغيير كلمة المرور بعد أول دخول:</p>
          <div className="bg-white rounded-s p-3 font-mono text-xs space-y-1" dir="ltr">
            <div>Email: <b>{result.ok.email}</b></div>
            <div>Password: <b>{result.ok.tempPassword}</b></div>
          </div>
        </div>
      )}

      <div className="pt-2">
        <h3 className="text-sm font-bold text-primary-dark mb-2">المديرون الحاليون ({managers.length})</h3>
        {managers.length === 0 ? (
          <p className="text-sm text-[#666]">لا يوجد مديرو فروع حاليًا.</p>
        ) : (
          <ul className="space-y-2">
            {managers.map((m) => (
              <li key={m.id} className="flex items-center justify-between bg-bg-light rounded-s p-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" dir="ltr">{m.email}</div>
                  <div className="text-xs text-[#666]">
                    {m.branch?.name_ar ?? '—'} {m.mfa_enabled && '· 🔒'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`حذف ${m.email}؟`)) return;
                    await removeBranchManager(m.id);
                    window.location.reload();
                  }}
                  className="text-danger text-xs hover:underline px-2"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
