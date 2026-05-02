import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { StackedBarChart, HourHeatmap } from '@/components/admin/charts';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';
import { resolveRange, bucketKey, type DateRangePreset, type Granularity } from '@/lib/admin/analytics';

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'yesterday', label: 'أمس' },
  { value: 'this_week', label: 'هذا الأسبوع' },
  { value: 'last_week', label: 'الأسبوع الماضي' },
  { value: 'this_month', label: 'هذا الشهر' },
  { value: 'last_month', label: 'الشهر الماضي' },
];
const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'يومي' },
  { value: 'weekly', label: 'أسبوعي' },
  { value: 'monthly', label: 'شهري' },
];
const COLORS = ['#578e7e', '#e3af64', '#3c655a', '#8eb5a7'];

interface Props {
  searchParams: Promise<{ preset?: string; granularity?: string; branch?: string }>;
}

export default async function OrdersAnalyticsPage({ searchParams }: Props) {
  const ctx = await requireAdmin();
  const params = await searchParams;
  const preset: DateRangePreset = (PRESETS.find((p) => p.value === params.preset)?.value as DateRangePreset) ?? 'this_month';
  const granularity: Granularity = (GRANULARITIES.find((g) => g.value === params.granularity)?.value as Granularity) ?? 'daily';
  const branchFilter = ctx.role === 'branch_manager' ? ctx.branchId : (params.branch || null);

  const { from, to } = resolveRange(preset);
  const supa = await createClient();

  const { data: branches } = await supa.from('branches').select('id, slug, name_ar').order('sort_order');

  let q = supa
    .from('orders')
    .select('id, branch_id, status, total, fulfillment_type, payment_method, payment_status, created_at')
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString());
  if (branchFilter) q = q.eq('branch_id', branchFilter);
  const { data: orders } = await q;

  const visibleBranches = branchFilter
    ? (branches ?? []).filter((b) => b.id === branchFilter)
    : branches ?? [];

  // KPIs
  const totalOrders = orders?.length ?? 0;
  const revenueOrders = (orders ?? []).filter((o) => ['confirmed', 'ready', 'completed'].includes(o.status));
  const totalRevenue = revenueOrders.reduce((s, o) => s + Number(o.total), 0);
  const avgOrderValue = revenueOrders.length > 0 ? totalRevenue / revenueOrders.length : 0;
  const pickups = (orders ?? []).filter((o) => o.fulfillment_type === 'pickup').length;
  const deliveries = totalOrders - pickups;
  const paid = (orders ?? []).filter((o) => o.payment_status === 'paid').length;
  const cancelled = (orders ?? []).filter((o) => o.status === 'cancelled').length;
  const cancelledRate = totalOrders > 0 ? (cancelled / totalOrders) * 100 : 0;

  // Bucketed series per branch
  const labels: string[] = [];
  const labelDateMap = new Map<string, Date>();
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = bucketKey(cursor, granularity);
    if (!labelDateMap.has(key)) {
      labelDateMap.set(key, new Date(cursor));
      labels.push(key);
    }
    if (granularity === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
    else if (granularity === 'weekly') cursor.setDate(cursor.getDate() + 7);
    else cursor.setDate(cursor.getDate() + 1);
  }

  const series = visibleBranches.map((br, i) => {
    const values = labels.map((lbl) => {
      return (orders ?? []).filter((o) => {
        if (o.branch_id !== br.id) return false;
        const d = new Date(o.created_at);
        return bucketKey(d, granularity) === lbl;
      }).length;
    });
    return { label: br.name_ar, values, color: COLORS[i % COLORS.length] };
  });

  // Branch comparison table
  const branchTable = visibleBranches.map((br) => {
    const branchOrders = (orders ?? []).filter((o) => o.branch_id === br.id);
    return {
      ...br,
      total: branchOrders.length,
      pickups: branchOrders.filter((o) => o.fulfillment_type === 'pickup').length,
      deliveries: branchOrders.filter((o) => o.fulfillment_type === 'delivery').length,
      reserved: branchOrders.filter((o) => ['pending', 'confirmed', 'ready'].includes(o.status)).length,
      completed: branchOrders.filter((o) => o.status === 'completed').length,
      cancelled: branchOrders.filter((o) => o.status === 'cancelled').length,
      revenue: branchOrders
        .filter((o) => ['confirmed', 'ready', 'completed'].includes(o.status))
        .reduce((s, o) => s + Number(o.total), 0),
    };
  });

  // Hour-of-day × day-of-week heatmap
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const o of orders ?? []) {
    const d = new Date(o.created_at);
    matrix[d.getDay()][d.getHours()] += 1;
  }

  // Format labels in human Arabic
  const labelDisplay = labels.map((k) => {
    const d = labelDateMap.get(k)!;
    if (granularity === 'monthly') return d.toLocaleDateString('ar-EG', { month: 'short' });
    if (granularity === 'weekly') return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  });

  function buildHref(p: { preset?: string; granularity?: string; branch?: string }) {
    const merged = { preset, granularity, branch: branchFilter ?? undefined, ...p };
    const qs = new URLSearchParams(
      Object.entries(merged).filter(([_, v]) => v !== undefined && v !== null) as [string, string][]
    );
    return `/admin/analytics/orders?${qs.toString()}`;
  }

  return (
    <PageShell title="تحليلات الطلبات" subtitle={`من ${from.toLocaleDateString('ar-EG')} إلى ${to.toLocaleDateString('ar-EG')}`}>
      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p) => (
            <Link
              key={p.value}
              href={buildHref({ preset: p.value })}
              className={`px-3 py-1.5 rounded-pill text-xs font-bold ${preset === p.value ? 'bg-primary text-white' : 'bg-bg-light text-ink hover:bg-primary-light'}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-[#666] ml-2">العرض:</span>
          {GRANULARITIES.map((g) => (
            <Link
              key={g.value}
              href={buildHref({ granularity: g.value })}
              className={`px-3 py-1 rounded-pill text-xs font-bold ${granularity === g.value ? 'bg-accent text-white' : 'bg-bg-light text-ink hover:bg-accent/20'}`}
            >
              {g.label}
            </Link>
          ))}
          {ctx.role === 'admin' && (
            <>
              <span className="text-xs text-[#666] ml-4 mr-2">الفرع:</span>
              <Link
                href={buildHref({ branch: undefined })}
                className={`px-3 py-1 rounded-pill text-xs font-bold ${!branchFilter ? 'bg-primary-dark text-white' : 'bg-bg-light text-ink hover:bg-primary-light'}`}
              >
                الكل
              </Link>
              {(branches ?? []).map((b) => (
                <Link
                  key={b.id}
                  href={buildHref({ branch: b.id })}
                  className={`px-3 py-1 rounded-pill text-xs font-bold ${branchFilter === b.id ? 'bg-primary-dark text-white' : 'bg-bg-light text-ink hover:bg-primary-light'}`}
                >
                  {b.name_ar}
                </Link>
              ))}
            </>
          )}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-6">
        <Kpi label="إجمالي الطلبات" value={totalOrders} />
        <Kpi label="الإيرادات" value={formatPrice(totalRevenue)} highlight />
        <Kpi label="متوسط الطلب" value={formatPrice(avgOrderValue)} />
        <Kpi label="استلام / توصيل" value={`${pickups} / ${deliveries}`} />
        <Kpi label="مدفوع" value={paid} />
        <Kpi label="نسبة الإلغاء" value={`${cancelledRate.toFixed(1)}%`} warn={cancelledRate > 10} />
      </div>

      {/* Bar chart */}
      <div className="card p-5 mb-6">
        <h2 className="font-bold text-primary-dark mb-4">الطلبات حسب الفرع — {GRANULARITIES.find((g) => g.value === granularity)?.label}</h2>
        {totalOrders === 0 ? (
          <p className="text-center text-[#666] py-12 text-sm">لا توجد طلبات في هذا النطاق</p>
        ) : (
          <StackedBarChart labels={labelDisplay} series={series} />
        )}
      </div>

      {/* Branch table */}
      <div className="card overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-primary-light text-primary-dark text-xs">
            <tr>
              <th className="text-right p-3">الفرع</th>
              <th className="text-center p-3">إجمالي</th>
              <th className="text-center p-3">استلام</th>
              <th className="text-center p-3">توصيل</th>
              <th className="text-center p-3">قيد المراجعة</th>
              <th className="text-center p-3">مكتمل</th>
              <th className="text-center p-3">ملغي</th>
              <th className="text-left p-3">الإيرادات</th>
            </tr>
          </thead>
          <tbody>
            {branchTable.map((b) => (
              <tr key={b.id} className="border-b border-bg-light hover:bg-bg-light/50 last:border-0">
                <td className="p-3 font-bold">
                  <Link href={`/admin/branches/${b.id}`} className="hover:text-primary">{b.name_ar}</Link>
                </td>
                <td className="p-3 text-center font-bold">{b.total}</td>
                <td className="p-3 text-center">{b.pickups}</td>
                <td className="p-3 text-center">{b.deliveries}</td>
                <td className="p-3 text-center">{b.reserved}</td>
                <td className="p-3 text-center text-success font-bold">{b.completed}</td>
                <td className="p-3 text-center text-danger">{b.cancelled}</td>
                <td className="p-3 text-left font-extrabold text-accent-dark">{formatPrice(b.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Heatmap */}
      <div className="card p-5">
        <h2 className="font-bold text-primary-dark mb-4">أوقات الذروة (يوم × ساعة)</h2>
        {totalOrders === 0 ? (
          <p className="text-center text-[#666] py-8 text-sm">لا توجد بيانات كافية</p>
        ) : (
          <HourHeatmap matrix={matrix} />
        )}
      </div>
    </PageShell>
  );
}

function Kpi({ label, value, warn, highlight }: { label: string; value: string | number; warn?: boolean; highlight?: boolean }) {
  const cls = warn ? 'text-accent-dark' : highlight ? 'text-primary' : 'text-primary-dark';
  return (
    <div className="card p-4">
      <div className={`text-xl font-extrabold ${cls}`}>{value}</div>
      <div className="text-xs text-[#666] mt-1">{label}</div>
    </div>
  );
}
