import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';

export default async function BranchesPage() {
  const ctx = await requireAdmin();
  const supa = await createClient();

  const { data: branches } = await supa
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  // Per-branch aggregates
  const stats = await Promise.all(
    (branches ?? []).map(async (b) => {
      const [{ count: totalOrders }, { count: pending }, revQ, stockQ] = await Promise.all([
        supa.from('orders').select('*', { count: 'exact', head: true }).eq('branch_id', b.id),
        supa.from('orders').select('*', { count: 'exact', head: true }).eq('branch_id', b.id).eq('status', 'pending'),
        supa.from('orders').select('total').eq('branch_id', b.id).in('status', ['confirmed', 'ready', 'completed']),
        supa.from('branch_stock').select('quantity').eq('branch_id', b.id),
      ]);
      const revenue = (revQ.data ?? []).reduce((s, r: any) => s + Number(r.total), 0);
      const totalStock = (stockQ.data ?? []).reduce((s, r: any) => s + r.quantity, 0);
      return {
        ...b,
        totalOrders: totalOrders ?? 0,
        pending: pending ?? 0,
        revenue,
        totalStock,
      };
    })
  );

  // Branch managers see only their branch
  const visible = ctx.role === 'branch_manager' && ctx.branchId
    ? stats.filter((s) => s.id === ctx.branchId)
    : stats;

  return (
    <PageShell title="الفروع" subtitle={`${visible.length} ${visible.length === 1 ? 'فرع' : 'فروع'}`}>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((b: any) => (
          <Link
            key={b.id}
            href={`/admin/branches/${b.id}`}
            className="card card-hover p-6"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-extrabold text-primary-dark text-lg">{b.name_ar}</h3>
                <p className="text-xs text-[#666] mt-1">{b.city}</p>
              </div>
              <i className="fa-solid fa-store text-2xl text-primary-light" />
            </div>
            <p className="text-xs text-[#666] mb-4 line-clamp-2 leading-loose">{b.address_ar}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-bg-light rounded-s p-3">
                <div className="text-xs text-[#666]">إجمالي الطلبات</div>
                <div className="font-extrabold text-primary-dark">{b.totalOrders}</div>
              </div>
              <div className="bg-bg-light rounded-s p-3">
                <div className="text-xs text-[#666]">قيد المراجعة</div>
                <div className={`font-extrabold ${b.pending > 0 ? 'text-accent-dark' : 'text-primary-dark'}`}>{b.pending}</div>
              </div>
              <div className="bg-bg-light rounded-s p-3 col-span-2">
                <div className="text-xs text-[#666]">الإيرادات</div>
                <div className="font-extrabold text-accent-dark">{formatPrice(b.revenue)}</div>
              </div>
              <div className="bg-bg-light rounded-s p-3 col-span-2">
                <div className="text-xs text-[#666]">إجمالي المخزون</div>
                <div className="font-extrabold text-primary">{b.totalStock} نسخة</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
