import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import StatusPill from '@/components/admin/status-pill';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/types';

interface Props { searchParams: Promise<{ status?: string; branch?: string; q?: string }> }

export default async function OrdersPage({ searchParams }: Props) {
  const ctx = await requireAdmin();
  const params = await searchParams;
  const supa = await createClient();

  const rawQ = (params.q ?? '').trim();
  const searchTerm = rawQ.replace(/[(),%]/g, ' ').trim();

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

  let q = supa
    .from('orders')
    .select('id, order_number, status, total, fulfillment_type, payment_method, payment_status, created_at, branch:branches(name_ar), student:students(full_name, phone)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (ctx.role === 'branch_manager' && ctx.branchId) q = q.eq('branch_id', ctx.branchId);
  else if (params.branch) q = q.eq('branch_id', params.branch);
  if (params.status) q = q.eq('status', params.status);
  if (searchTerm) {
    const ilike = `%${searchTerm}%`;
    q = matchedStudentIds.length > 0
      ? q.or(`order_number.ilike.${ilike},student_id.in.(${matchedStudentIds.join(',')})`)
      : q.ilike('order_number', ilike);
  }

  const { data: orders } = await q;

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

  const clearSearchHref = (() => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.branch) qs.set('branch', params.branch);
    const s = qs.toString();
    return s ? `/admin/orders?${s}` : '/admin/orders';
  })();

  return (
    <PageShell
      title="الطلبات"
      subtitle={`${orders?.length ?? 0} طلب`}
      actions={
        <a href="/api/admin/export/orders" download className="btn bg-white text-primary-dark hover:bg-bg-light px-5 py-2 text-sm">
          <i className="fa-solid fa-file-csv ml-2" />
          تنزيل CSV
        </a>
      }
    >
      {/* Search */}
      <form method="GET" action="/admin/orders" className="mb-5">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.branch && <input type="hidden" name="branch" value={params.branch} />}
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
            <Link href={clearSearchHref} className="btn bg-white text-ink hover:bg-bg-light px-3 sm:px-4 py-2 sm:py-2.5 text-sm">
              مسح
            </Link>
          )}
        </div>
      </form>

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
      </div>

      {ctx.role === 'admin' && branches && branches.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <span className="text-xs text-[#666] ml-2">الفرع:</span>
          <Link
            href={params.status ? `/admin/orders?status=${params.status}` : '/admin/orders'}
            className={`px-3 py-1 rounded-pill text-xs font-bold ${!params.branch ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
          >
            كل الفروع
          </Link>
          {branches.map((b) => {
            const qs = new URLSearchParams();
            if (params.status) qs.set('status', params.status);
            qs.set('branch', b.id);
            return (
              <Link
                key={b.id}
                href={`/admin/orders?${qs.toString()}`}
                className={`px-3 py-1 rounded-pill text-xs font-bold ${params.branch === b.id ? 'bg-primary-dark text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
              >
                {b.name_ar}
              </Link>
            );
          })}
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
              <th className="text-right p-4">النوع</th>
              <th className="text-right p-4">طريقة الدفع</th>
              <th className="text-right p-4">حالة الدفع</th>
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
                <td className="p-4 text-xs">{paymentMethodLabels[o.payment_method as PaymentMethod] ?? o.payment_method}</td>
                <td className="p-4">
                  <span className={`${paymentStatusBg[o.payment_status as PaymentStatus]} px-2.5 py-1 rounded-pill text-xs font-bold whitespace-nowrap`}>
                    {paymentStatusLabels[o.payment_status as PaymentStatus] ?? o.payment_status}
                  </span>
                </td>
                <td className="p-4"><StatusPill status={o.status} /></td>
                <td className="p-4 text-left font-bold">{formatPrice(Number(o.total))}</td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr><td colSpan={9} className="p-12 text-center text-[#666]">لا توجد طلبات بهذه المواصفات.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
