import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import StatusPill from '@/components/admin/status-pill';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';
import type {
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from '@/lib/types';

interface Props {
  searchParams: Promise<{
    status?: string;
    branch?: string;
    q?: string;
    payment_type?: string;
    source?: string;
  }>;
}

type FilterParams = {
  status?: string;
  branch?: string;
  q?: string;
  payment_type?: string;
  source?: string;
};

// Build a /admin/orders URL that preserves the current filters and applies overrides.
// Pass `null` for an override key to remove that filter.
function buildHref(current: FilterParams, overrides: Partial<Record<keyof FilterParams, string | null>>) {
  const merged: FilterParams = { ...current };
  for (const k of Object.keys(overrides) as Array<keyof FilterParams>) {
    const v = overrides[k];
    if (v === null) delete merged[k];
    else if (v !== undefined) merged[k] = v;
  }
  const qs = new URLSearchParams();
  for (const k of Object.keys(merged) as Array<keyof FilterParams>) {
    const v = merged[k];
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `/admin/orders?${s}` : '/admin/orders';
}

export default async function OrdersPage({ searchParams }: Props) {
  const ctx = await requireAdmin();
  const params = await searchParams;
  const supa = await createClient();

  const rawQ = (params.q ?? '').trim();
  const searchTerm = rawQ.replace(/[(),%]/g, ' ').trim();

  const paymentType =
    params.payment_type === 'online' || params.payment_type === 'offline' ? params.payment_type : undefined;
  const source =
    params.source === 'storefront' || params.source === 'dashboard' ? params.source : undefined;

  const { data: branches } = await supa.from('branches').select('id, slug, name_ar').order('sort_order');

  let matchedStudentIds: string[] = [];
  if (searchTerm) {
    const ilike = `%${searchTerm}%`;
    const { data: matchedStudents } = await supa
      .from('students')
      .select('id')
      .or(`full_name.ilike.${ilike},phone.ilike.${ilike}`)
      .limit(200);
    matchedStudentIds = (matchedStudents ?? []).map((s: { id: string }) => s.id);
  }

  // Apply every shared filter except payment_type — the summary cards split BY
  // payment_type, so applying that filter to the summary would zero out one card.
  const applyShared = (qb: any, includePaymentType: boolean): any => {
    let out = qb;
    if (ctx.role === 'branch_manager' && ctx.branchId) out = out.eq('branch_id', ctx.branchId);
    else if (params.branch) out = out.eq('branch_id', params.branch);
    if (params.status) out = out.eq('status', params.status);
    if (source) out = out.eq('order_source', source);
    if (includePaymentType && paymentType) out = out.eq('payment_type', paymentType);
    if (searchTerm) {
      const ilike = `%${searchTerm}%`;
      out =
        matchedStudentIds.length > 0
          ? out.or(`order_number.ilike.${ilike},student_id.in.(${matchedStudentIds.join(',')})`)
          : out.ilike('order_number', ilike);
    }
    return out;
  };

  // Table query — applies all filters including payment_type, capped at 100 rows.
  const tableQ = applyShared(
    supa
      .from('orders')
      .select(
        'id, order_number, status, total, fulfillment_type, payment_method, payment_status, payment_type, order_source, created_at, branch:branches(name_ar), student:students(full_name, phone)',
      )
      .order('created_at', { ascending: false })
      .limit(100),
    true,
  );

  // Summary query — same filters, EXCLUDING payment_type so both cards stay populated.
  // 10k cap is a guardrail; current volume is much smaller.
  const summaryQ = applyShared(
    supa.from('orders').select('payment_type, total').limit(10000),
    false,
  );

  const [{ data: orders }, { data: summaryRows }] = await Promise.all([tableQ, summaryQ]);

  // Aggregate summary in JS — Supabase JS client has no native sum().
  const summary = {
    online: { count: 0, revenue: 0 },
    offline: { count: 0, revenue: 0 },
  };
  for (const r of (summaryRows ?? []) as Array<{ payment_type: PaymentType; total: number }>) {
    const bucket = summary[r.payment_type];
    if (!bucket) continue;
    bucket.count += 1;
    bucket.revenue += Number(r.total) || 0;
  }
  const totalCount = summary.online.count + summary.offline.count;
  const totalRevenue = summary.online.revenue + summary.offline.revenue;

  const statuses: OrderStatus[] = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];
  const statusLabels: Record<OrderStatus, string> = {
    pending: 'قيد المراجعة', confirmed: 'مؤكد', ready: 'جاهز', completed: 'مكتمل', cancelled: 'ملغي',
  };

  const paymentMethodLabels: Record<PaymentMethod, string> = {
    cod: 'كاش', card: 'بطاقة', wallet: 'محفظة', fawry: 'فوري', instapay: 'إنستاباي', bank_transfer: 'تحويل بنكي',
  };
  const paymentStatusLabels: Record<PaymentStatus, string> = {
    pending: 'قيد الانتظار', paid: 'مدفوع', failed: 'فشل', refunded: 'مسترد',
  };
  const paymentStatusBg: Record<PaymentStatus, string> = {
    pending: 'bg-primary-light text-primary-dark',
    paid: 'bg-success text-white',
    failed: 'bg-danger text-white',
    refunded: 'bg-bg-light text-[#666]',
  };
  const sourceLabels: Record<OrderSource, string> = {
    storefront: 'متجر',
    dashboard: 'داخلي',
  };
  const sourceBg: Record<OrderSource, string> = {
    storefront: 'bg-bg-light text-ink',
    dashboard: 'bg-accent/20 text-primary-dark',
  };
  const paymentTypeLabels: Record<PaymentType, string> = {
    online: 'online',
    offline: 'offline',
  };
  const paymentTypeBg: Record<PaymentType, string> = {
    online: 'bg-primary text-white',
    offline: 'bg-primary-light text-primary-dark',
  };

  const hasAnyFilter = !!(params.status || params.branch || paymentType || source || rawQ);

  return (
    <PageShell
      title="الطلبات"
      subtitle={`${orders?.length ?? 0} طلب معروض${totalCount > 0 ? ` من إجمالي ${totalCount} مطابق للفلاتر` : ''}`}
      actions={
        <div className="flex gap-2">
          <Link
            href="/admin/orders/new"
            className="btn bg-accent text-primary-dark hover:bg-accent/90 px-5 py-2 text-sm font-bold"
          >
            <i className="fa-solid fa-plus ml-2" />
            طلب يدوي
          </Link>
          <a href="/api/admin/export/orders" download className="btn bg-white text-primary-dark hover:bg-bg-light px-5 py-2 text-sm">
            <i className="fa-solid fa-file-csv ml-2" />
            تنزيل CSV
          </a>
        </div>
      }
    >
      {/* Summary cards — totals respect every filter except payment_type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard
          label="طلبات online"
          count={summary.online.count}
          revenue={summary.online.revenue}
          tone="primary"
          icon="fa-credit-card"
        />
        <SummaryCard
          label="طلبات offline"
          count={summary.offline.count}
          revenue={summary.offline.revenue}
          tone="accent"
          icon="fa-money-bill-wave"
        />
        <SummaryCard
          label="الإجمالي المطابق للفلاتر"
          count={totalCount}
          revenue={totalRevenue}
          tone="dark"
          icon="fa-chart-line"
        />
      </div>

      {/* Search */}
      <form method="GET" action="/admin/orders" className="mb-5">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.branch && <input type="hidden" name="branch" value={params.branch} />}
        {paymentType && <input type="hidden" name="payment_type" value={paymentType} />}
        {source && <input type="hidden" name="source" value={source} />}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <i className="fa-solid fa-search absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-[#999]" />
            <input
              type="search"
              name="q"
              defaultValue={rawQ}
              placeholder="بحث برقم الطلب، اسم الطالب، أو الهاتف"
              className="w-full pr-10 sm:pr-11 pl-3 sm:pl-4 py-2 sm:py-2.5 border border-bg-light rounded-pill bg-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button type="submit" className="btn bg-primary text-white hover:bg-primary-dark px-4 sm:px-6 py-2 sm:py-2.5 text-sm">
            بحث
          </button>
          {rawQ && (
            <Link href={buildHref(params, { q: null })} className="btn bg-white text-ink hover:bg-bg-light px-3 sm:px-4 py-2 sm:py-2.5 text-sm">
              مسح
            </Link>
          )}
        </div>
      </form>

      {/* Status filter */}
      <div className="flex flex-wrap gap-3 mb-3">
        <Link
          href={buildHref(params, { status: null })}
          className={`px-4 py-2 rounded-pill text-sm font-bold ${!params.status ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
        >
          كل الحالات
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={buildHref(params, { status: s })}
            className={`px-4 py-2 rounded-pill text-sm font-bold ${params.status === s ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
          >
            {statusLabels[s]}
          </Link>
        ))}
      </div>

      {/* Payment type filter */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <span className="text-xs text-[#666] ml-2">نوع الدفع:</span>
        <Link
          href={buildHref(params, { payment_type: null })}
          className={`px-3 py-1 rounded-pill text-xs font-bold ${!paymentType ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
        >
          الكل
        </Link>
        <Link
          href={buildHref(params, { payment_type: 'online' })}
          className={`px-3 py-1 rounded-pill text-xs font-bold ${paymentType === 'online' ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
        >
          online
        </Link>
        <Link
          href={buildHref(params, { payment_type: 'offline' })}
          className={`px-3 py-1 rounded-pill text-xs font-bold ${paymentType === 'offline' ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
        >
          offline
        </Link>
      </div>

      {/* Order source filter */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <span className="text-xs text-[#666] ml-2">المصدر:</span>
        <Link
          href={buildHref(params, { source: null })}
          className={`px-3 py-1 rounded-pill text-xs font-bold ${!source ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
        >
          الكل
        </Link>
        <Link
          href={buildHref(params, { source: 'storefront' })}
          className={`px-3 py-1 rounded-pill text-xs font-bold ${source === 'storefront' ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
        >
          متجر (storefront)
        </Link>
        <Link
          href={buildHref(params, { source: 'dashboard' })}
          className={`px-3 py-1 rounded-pill text-xs font-bold ${source === 'dashboard' ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
        >
          داخلي (dashboard)
        </Link>
      </div>

      {/* Branch filter (admins only) */}
      {ctx.role === 'admin' && branches && branches.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <span className="text-xs text-[#666] ml-2">الفرع:</span>
          <Link
            href={buildHref(params, { branch: null })}
            className={`px-3 py-1 rounded-pill text-xs font-bold ${!params.branch ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
          >
            كل الفروع
          </Link>
          {branches.map((b) => (
            <Link
              key={b.id}
              href={buildHref(params, { branch: b.id })}
              className={`px-3 py-1 rounded-pill text-xs font-bold ${params.branch === b.id ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
            >
              {b.name_ar}
            </Link>
          ))}
        </div>
      )}

      {hasAnyFilter && (
        <div className="mb-5">
          <Link
            href="/admin/orders"
            className="text-xs text-primary hover:text-primary-dark font-bold"
          >
            <i className="fa-solid fa-xmark ml-1" />
            مسح كل الفلاتر
          </Link>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary-light text-primary-dark text-xs">
            <tr>
              <th className="text-right p-4">رقم الطلب</th>
              <th className="text-right p-4">التاريخ</th>
              <th className="text-right p-4">الطالب</th>
              <th className="text-right p-4">الفرع</th>
              <th className="text-right p-4">المصدر</th>
              <th className="text-right p-4">نوع الدفع</th>
              <th className="text-right p-4">طريقة الدفع</th>
              <th className="text-right p-4">حالة الدفع</th>
              <th className="text-right p-4">الحالة</th>
              <th className="text-right p-4">المبلغ</th>
              <th className="text-center p-4">الإجراءات</th>
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
                <td className="p-4">
                  <span className={`${sourceBg[o.order_source as OrderSource] ?? 'bg-bg-light'} px-2.5 py-1 rounded-pill text-xs font-bold whitespace-nowrap`}>
                    {sourceLabels[o.order_source as OrderSource] ?? o.order_source ?? '—'}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`${paymentTypeBg[o.payment_type as PaymentType] ?? 'bg-bg-light'} px-2.5 py-1 rounded-pill text-xs font-bold whitespace-nowrap`}>
                    {paymentTypeLabels[o.payment_type as PaymentType] ?? o.payment_type ?? '—'}
                  </span>
                </td>
                <td className="p-4 text-xs">{paymentMethodLabels[o.payment_method as PaymentMethod] ?? o.payment_method}</td>
                <td className="p-4">
                  <span className={`${paymentStatusBg[o.payment_status as PaymentStatus]} px-2.5 py-1 rounded-pill text-xs font-bold whitespace-nowrap`}>
                    {paymentStatusLabels[o.payment_status as PaymentStatus] ?? o.payment_status}
                  </span>
                </td>
                <td className="p-4"><StatusPill status={o.status} /></td>
                <td className="p-4 font-bold">{formatPrice(Number(o.total))}</td>
                <td className="p-4 text-center">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-primary-light text-primary-dark hover:bg-primary hover:text-white text-xs font-bold whitespace-nowrap transition-colors"
                  >
                    <i className="fa-solid fa-eye" />
                    تفاصيل
                  </Link>
                </td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr><td colSpan={11} className="p-12 text-center text-[#666]">لا توجد طلبات بهذه المواصفات.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function SummaryCard({
  label,
  count,
  revenue,
  tone,
  icon,
}: {
  label: string;
  count: number;
  revenue: number;
  tone: 'primary' | 'accent' | 'dark';
  icon: string;
}) {
  const toneCls =
    tone === 'primary'
      ? 'bg-primary-light text-primary-dark'
      : tone === 'accent'
        ? 'bg-accent/20 text-primary-dark'
        : 'bg-primary-dark text-white';
  return (
    <div className={`card p-4 ${toneCls}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold opacity-90">{label}</span>
        <i className={`fa-solid ${icon} opacity-70`} />
      </div>
      <div className="text-2xl font-extrabold">{count}</div>
      <div className="text-xs opacity-90 mt-1">إيراد: {formatPrice(revenue)}</div>
    </div>
  );
}
