import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function PromosPage() {
  await requireFullAdmin();
  const supa = await createClient();
  const { data: codes } = await supa.from('promo_codes').select('*').order('created_at', { ascending: false });

  return (
    <PageShell
      title="أكواد الخصم"
      subtitle={`${codes?.length ?? 0} كود`}
      actions={
        <Link href="/admin/promos/new" className="btn bg-white text-primary-dark hover:bg-bg-light px-5 py-2 text-sm">
          <i className="fa-solid fa-plus ml-2" />
          إنشاء كود جديد
        </Link>
      }
    >
      {(!codes || codes.length === 0) ? (
        <div className="card p-12 text-center">
          <i className="fa-solid fa-tag text-5xl text-primary-light block mb-4" />
          <p className="text-[#666] mb-4">لا توجد أكواد خصم بعد</p>
          <Link href="/admin/promos/new" className="btn btn-primary">إنشاء أول كود</Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-light text-primary-dark text-xs">
              <tr>
                <th className="text-right p-3">الكود</th>
                <th className="text-right p-3">الخصم</th>
                <th className="text-right p-3">الفترة</th>
                <th className="text-center p-3">الاستخدام</th>
                <th className="text-center p-3">الحالة</th>
                <th className="text-left p-3"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c: any) => (
                <tr key={c.id} className="border-b border-bg-light hover:bg-bg-light/50 last:border-0">
                  <td className="p-3 font-bold font-mono" dir="ltr">{c.code}</td>
                  <td className="p-3 font-bold text-accent-dark">
                    {c.discount_value}{c.discount_type === 'percentage' ? '%' : ' جنيه'}
                  </td>
                  <td className="p-3 text-xs text-[#666]">
                    {c.valid_from ? new Date(c.valid_from).toLocaleDateString('ar-EG') : 'بدون بداية'}
                    {' → '}
                    {c.valid_to ? new Date(c.valid_to).toLocaleDateString('ar-EG') : 'بدون نهاية'}
                  </td>
                  <td className="p-3 text-center">
                    {c.times_used}{c.usage_limit ? ` / ${c.usage_limit}` : ''}
                  </td>
                  <td className="p-3 text-center text-xs">
                    {c.is_active ? <span className="text-success">✓ مفعّل</span> : <span className="text-danger">✗ معطل</span>}
                  </td>
                  <td className="p-3 text-left">
                    <Link href={`/admin/promos/${c.id}/edit`} className="text-primary text-sm hover:text-primary-dark">تعديل</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
