import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { gradeLabelAr } from '@/lib/utils';
import type { GradeLevel } from '@/lib/types';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function AdminStudentsPage() {
  await requireFullAdmin();
  const supa = await createClient();

  const { data: students } = await supa
    .from('students')
    .select('id, full_name, phone, email, grade_level, governorate, books_ordered_count, cap_override, auth_provider, created_at')
    .order('created_at', { ascending: false });

  return (
    <PageShell
      title="الطلاب"
      subtitle={`${students?.length ?? 0} حساب طالب`}
      actions={
        <a href="/api/admin/export/students" download className="btn bg-white text-primary-dark hover:bg-bg-light px-5 py-2 text-sm">
          <i className="fa-solid fa-file-csv ml-2" />
          تنزيل CSV
        </a>
      }
    >
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary-light text-primary-dark text-xs">
            <tr>
              <th className="text-right p-3">الاسم</th>
              <th className="text-right p-3">الموبايل</th>
              <th className="text-right p-3">الإيميل</th>
              <th className="text-right p-3">الصف</th>
              <th className="text-right p-3">المحافظة</th>
              <th className="text-center p-3">الكتب المطلوبة</th>
              <th className="text-right p-3">طريقة التسجيل</th>
              <th className="text-right p-3">تاريخ التسجيل</th>
            </tr>
          </thead>
          <tbody>
            {(students ?? []).map((s: any) => {
              const cap = s.cap_override ?? 10;
              const overCap = s.books_ordered_count >= cap;
              return (
                <tr key={s.id} className="border-b border-bg-light hover:bg-bg-light/50 last:border-0">
                  <td className="p-3 font-bold">{s.full_name ?? '—'}</td>
                  <td className="p-3 text-xs" dir="ltr">{s.phone ?? '—'}</td>
                  <td className="p-3 text-xs" dir="ltr">{s.email ?? '—'}</td>
                  <td className="p-3 text-xs">{s.grade_level ? gradeLabelAr[s.grade_level as GradeLevel] : '—'}</td>
                  <td className="p-3 text-xs">{s.governorate ?? '—'}</td>
                  <td className={`p-3 text-center font-bold ${overCap ? 'text-danger' : 'text-primary-dark'}`}>
                    {s.books_ordered_count}/{cap}
                    {overCap && <span className="block text-[10px] text-danger">🚫 وصل للحد</span>}
                  </td>
                  <td className="p-3 text-xs">
                    {s.auth_provider === 'google' && <span><i className="fa-brands fa-google text-[#DB4437]" /> Google</span>}
                    {s.auth_provider === 'facebook' && <span><i className="fa-brands fa-facebook text-[#1877F2]" /> Facebook</span>}
                    {s.auth_provider === 'email' && <span><i className="fa-solid fa-envelope" /> إيميل</span>}
                  </td>
                  <td className="p-3 text-xs text-[#666]">
                    {new Date(s.created_at).toLocaleDateString('ar-EG', { dateStyle: 'short' })}
                  </td>
                </tr>
              );
            })}
            {(!students || students.length === 0) && (
              <tr><td colSpan={8} className="p-12 text-center text-[#666]">لا يوجد طلاب مسجلين بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
