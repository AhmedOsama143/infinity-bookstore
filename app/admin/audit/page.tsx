import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function AuditLogPage() {
  await requireFullAdmin();
  const supa = await createClient();
  const { data: logs } = await supa
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <PageShell title="سجل التدقيق" subtitle="آخر ٢٠٠ عملية حساسة">
      {(!logs || logs.length === 0) ? (
        <div className="card p-12 text-center text-[#666]">
          <i className="fa-solid fa-shield-halved text-5xl text-primary-light block mb-4" />
          سجل التدقيق فارغ. سيتم تسجيل العمليات التي يقوم بها المستخدمون من هنا.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-light text-primary-dark text-xs">
              <tr>
                <th className="text-right p-3">الوقت</th>
                <th className="text-right p-3">المستخدم</th>
                <th className="text-right p-3">الدور</th>
                <th className="text-right p-3">العملية</th>
                <th className="text-right p-3">الكيان</th>
                <th className="text-right p-3">المعرف</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="border-b border-bg-light hover:bg-bg-light/50 last:border-0">
                  <td className="p-3 text-xs text-[#666]">
                    {new Date(log.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="p-3 text-xs" dir="ltr">{log.actor_id?.slice(0, 8) ?? '—'}…</td>
                  <td className="p-3 text-xs">{log.actor_role ?? '—'}</td>
                  <td className="p-3 font-bold">{log.action}</td>
                  <td className="p-3 text-xs">{log.entity_type}</td>
                  <td className="p-3 text-xs font-mono" dir="ltr">{log.entity_id?.slice(0, 12) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
