import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import StatusPill from '@/components/admin/status-pill';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';
import type { OrderStatus } from '@/lib/types';

interface Props { searchParams: Promise<{ status?: string; branch?: string }> }

export default async function OrdersPage({ searchParams }: Props) {
  const ctx = await requireAdmin();
  const params = await searchParams;
  const supa = await createClient();

  const { data: branches } = await supa.from('branches').select('id, slug, name_ar').order('sort_order');

  let q = supa
    .from('orders')
    .select('id, order_number, status, total, fulfillment_type, payment_method, created_at, branch:branches(name_ar), student:students(full_name, phone)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (ctx.role === 'branch_manager' && ctx.branchId) q = q.eq('branch_id', ctx.branchId);
  else if (params.branch) q = q.eq('branch_id', params.branch);
  if (params.status) q = q.eq('status', params.status);

  const { data: orders } = await q;

  const statuses: OrderStatus[] = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];
  const statusLabels: Record<OrderStatus, string> = {
    pending: 'قيد المراجعة', confirmed: 'مؤكد', ready: 'جاهز', completed: 'مكتمل', cancelled: 'ملغي',
  };

  return (
    <PageShell title="الطلبات" subtitle={`${orders?.length ?? 0} طلب`}>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Link
          href="/admin/orders"
          className={`px-4 py-2 rounded-pill text-sm font-bold ${!params.status && !params.branch ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
        >
          الكل
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`px-4 py-2 rounded-pill text-sm font-bold ${params.status === s ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
          >
            {statusLabels[s]}
          </Link>
        ))}
        {ctx.role === 'admin' && branches && branches.length > 0 && (
          <select
            className="bg-white px-4 py-2 rounded-pill text-sm font-bold border border-[#ddd]"
            defaultValue={params.branch ?? ''}
            onChange={() => {}}
          >
            <option value="">كل الفروع</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary-light text-primary-dark text-xs">
            <tr>
              <th className="text-right p-4">رقم الطلب</th>
              <th className="text-right p-4">التاريخ</th>
              <th className="text-right p-4">الطالب</th>
              <th className="text-right p-4">الفرع</th>
              <th className="text-right p-4">النوع</th>
              <th className="text-right p-4">الدفع</th>
              <th className="text-right p-4">الحالة</th>
              <th className="text-left p-4">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o: any) => (
              <tr key={o.id} className="border-b border-bg-light hover:bg-bg-light/50 last:border-0">
                <td className="p-4">
                  <Link href={`/admin/orders/${o.id}`} className="text-primary font-bold hover:text-primary-dark">
                    {o.order_number}
                  </Link>
                </td>
                <td className="p-4 text-xs text-[#666]">
                  {new Date(o.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="p-4">
                  <div className="font-bold">{o.student?.full_name ?? '—'}</div>
                  <div className="text-xs text-[#666]" dir="ltr">{o.student?.phone ?? ''}</div>
                </td>
                <td className="p-4 text-xs">{o.branch?.name_ar ?? '—'}</td>
                <td className="p-4 text-xs">{o.fulfillment_type === 'pickup' ? 'استلام' : 'توصيل'}</td>
                <td className="p-4 text-xs">{o.payment_method === 'cod' ? 'كاش' : o.payment_method}</td>
                <td className="p-4"><StatusPill status={o.status} /></td>
                <td className="p-4 text-left font-bold">{formatPrice(Number(o.total))}</td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr><td colSpan={8} className="p-12 text-center text-[#666]">لا توجد طلبات بهذه المواصفات.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
