import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';
import type { OrderStatus } from '@/lib/types';

export default async function AdminOverviewPage() {
  const ctx = await requireAdmin();
  const supa = await createClient();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

  const branchFilter = ctx.role === 'branch_manager' && ctx.branchId
    ? { column: 'branch_id', value: ctx.branchId }
    : null;

  // Build a query helper
  function ordersQuery(extra?: (q: any) => any) {
    let q = supa.from('orders').select('*', { count: 'exact', head: true });
    if (branchFilter) q = q.eq(branchFilter.column, branchFilter.value);
    if (extra) q = extra(q);
    return q;
  }

  const [ordersToday, ordersWeek, ordersMonth, pendingOrders, totalRevenue, lowStock, latestOrders, branches] = await Promise.all([
    ordersQuery((q) => q.gte('created_at', today.toISOString())),
    ordersQuery((q) => q.gte('created_at', weekAgo.toISOString())),
    ordersQuery((q) => q.gte('created_at', monthAgo.toISOString())),
    ordersQuery((q) => q.eq('status', 'pending')),
    (async () => {
      let q = supa.from('orders').select('total').in('status', ['confirmed', 'ready', 'completed']);
      if (branchFilter) q = q.eq(branchFilter.column, branchFilter.value);
      const { data } = await q;
      return (data ?? []).reduce((s, r: any) => s + Number(r.total), 0);
    })(),
    (async () => {
      let q = supa.from('branch_stock').select('book_id, branch_id, quantity, books(title_ar), branches(name_ar)').lte('quantity', 3);
      if (branchFilter) q = q.eq('branch_id', branchFilter.value);
      const { data } = await q;
      return data ?? [];
    })(),
    (async () => {
      let q = supa
        .from('orders')
        .select('id, order_number, status, total, fulfillment_type, created_at, branch:branches(name_ar), student:students(full_name)')
        .order('created_at', { ascending: false })
        .limit(10);
      if (branchFilter) q = q.eq(branchFilter.column, branchFilter.value);
      const { data } = await q;
      return data ?? [];
    })(),
    supa.from('branches').select('id, name_ar, slug').eq('is_active', true).order('sort_order'),
  ]);

  // Per-branch revenue & order counts (admin only — branch managers see only their own)
  const branchRows = branches.data ?? [];
  const perBranch: Array<{ id: string; name_ar: string; orders: number; revenue: number }> = [];
  if (!branchFilter) {
    const { data: byBranch } = await supa
      .from('orders')
      .select('branch_id, total, status')
      .in('status', ['confirmed', 'ready', 'completed']);
    for (const br of branchRows) {
      const rows = (byBranch ?? []).filter((r: any) => r.branch_id === br.id);
      perBranch.push({
        id: br.id,
        name_ar: br.name_ar,
        orders: rows.length,
        revenue: rows.reduce((s, r: any) => s + Number(r.total), 0),
      });
    }
  }

  return (
    <PageShell title="نظرة عامة" subtitle={`أهلاً ${ctx.email ?? ''}`}>
      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="طلبات اليوم"      value={ordersToday.count ?? 0}          icon="fa-calendar-day" />
        <Kpi label="طلبات الأسبوع"    value={ordersWeek.count ?? 0}           icon="fa-calendar-week" />
        <Kpi label="طلبات الشهر"      value={ordersMonth.count ?? 0}          icon="fa-calendar" />
        <Kpi label="إجمالي الإيرادات" value={formatPrice(totalRevenue)}       icon="fa-coins" highlight />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <Kpi label="بانتظار التأكيد"   value={pendingOrders.count ?? 0} icon="fa-clock" warn={(pendingOrders.count ?? 0) > 0} />
        <Kpi label="مخزون منخفض"      value={lowStock.length}            icon="fa-triangle-exclamation" warn={lowStock.length > 0} />
        <Kpi label="عدد الفروع"        value={branchRows.length}          icon="fa-store" />
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 sm:gap-6">
        {/* Latest orders */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-primary-dark">أحدث الطلبات</h2>
            <Link href="/admin/orders" className="text-primary text-sm font-bold hover:text-primary-dark">عرض الكل ←</Link>
          </div>
          {latestOrders.length === 0 ? (
            <p className="text-sm text-[#666] text-center py-6">لا توجد طلبات بعد</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="text-xs text-[#666] border-b border-bg-light">
                  <tr>
                    <th className="text-right py-2 px-2">رقم الطلب</th>
                    <th className="text-right py-2 px-2">الطالب</th>
                    <th className="text-right py-2 px-2">الفرع</th>
                    <th className="text-right py-2 px-2">الحالة</th>
                    <th className="text-left py-2 px-2">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {latestOrders.map((o: any) => (
                    <tr key={o.id} className="border-b border-bg-light last:border-0 hover:bg-bg-light/50">
                      <td className="py-3 px-2">
                        <Link href={`/admin/orders/${o.id}`} className="text-primary font-bold hover:text-primary-dark">
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="py-3 px-2 text-sm">{o.student?.full_name ?? '—'}</td>
                      <td className="py-3 px-2 text-xs">{o.branch?.name_ar ?? '—'}</td>
                      <td className="py-3 px-2"><StatusPill status={o.status} /></td>
                      <td className="py-3 px-2 text-left font-bold">{formatPrice(Number(o.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Revenue per branch (admin only) */}
        {!branchFilter && (
          <div className="card p-5">
            <h2 className="font-bold text-primary-dark mb-4">إيرادات الفروع</h2>
            <ul className="space-y-3">
              {perBranch.map((b) => (
                <li key={b.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <Link href={`/admin/branches/${b.id}`} className="font-bold hover:text-primary">
                      {b.name_ar}
                    </Link>
                    <span className="text-accent-dark font-extrabold">{formatPrice(b.revenue)}</span>
                  </div>
                  <div className="text-xs text-[#888]">{b.orders} طلب</div>
                </li>
              ))}
              {perBranch.length === 0 && <li className="text-sm text-[#666]">لا توجد إيرادات بعد</li>}
            </ul>
          </div>
        )}

        {/* Low-stock alerts */}
        {lowStock.length > 0 && (
          <div className="card p-5 border-r-4 border-accent">
            <h2 className="font-bold text-accent-dark mb-3">
              <i className="fa-solid fa-triangle-exclamation ml-2" />
              تنبيهات مخزون منخفض
            </h2>
            <ul className="space-y-2 text-sm max-h-72 overflow-y-auto">
              {lowStock.slice(0, 10).map((s: any, i: number) => (
                <li key={i} className="flex justify-between border-b border-bg-light pb-2 last:border-0">
                  <span className="truncate">
                    {s.books?.title_ar} <span className="text-[#888]">({s.branches?.name_ar})</span>
                  </span>
                  <span className={`font-bold ${s.quantity === 0 ? 'text-danger' : 'text-accent-dark'}`}>
                    {s.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Kpi({ label, value, icon, warn, highlight }: { label: string; value: string | number; icon: string; warn?: boolean; highlight?: boolean }) {
  const baseColor = warn ? 'text-accent-dark' : highlight ? 'text-primary' : 'text-primary-dark';
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <i className={`fa-solid ${icon} text-xl ${baseColor}`} />
      </div>
      <div className={`text-2xl font-extrabold ${baseColor}`}>{value}</div>
      <div className="text-sm text-[#666] mt-1 font-body">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { bg: string; label: string }> = {
    pending:    { bg: 'bg-primary-light text-primary-dark',     label: 'قيد المراجعة' },
    confirmed:  { bg: 'bg-accent text-white',                    label: 'مؤكد' },
    ready:      { bg: 'bg-success text-white',                   label: 'جاهز' },
    completed:  { bg: 'bg-success text-white',                   label: 'مكتمل' },
    cancelled:  { bg: 'bg-danger text-white',                    label: 'ملغي' },
  };
  const m = map[status];
  return <span className={`${m.bg} px-2.5 py-1 rounded-pill text-xs font-bold whitespace-nowrap`}>{m.label}</span>;
}
