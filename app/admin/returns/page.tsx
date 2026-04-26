import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import ReturnRow from '@/components/admin/return-row';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function ReturnsPage() {
  await requireFullAdmin();
  const supa = await createClient();
  const { data: returns } = await supa
    .from('returns')
    .select('id, order_id, items, reason, status, refund_amount, requested_at, resolved_at, order:orders(order_number, total, student:students(full_name, phone), branch:branches(name_ar))')
    .order('requested_at', { ascending: false });

  return (
    <PageShell title="طلبات الإرجاع" subtitle={`${returns?.length ?? 0} طلب`}>
      {!returns || returns.length === 0 ? (
        <div className="card p-12 text-center">
          <i className="fa-regular fa-circle-check text-5xl text-success block mb-4" />
          <p className="text-[#666]">لا توجد طلبات إرجاع حاليًا</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((r: any) => <ReturnRow key={r.id} ret={r} />)}
        </div>
      )}
    </PageShell>
  );
}
