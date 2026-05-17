import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';

export const metadata = { title: 'دفعات فوري | لوحة الإدارة' };

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'قيد التأكيد',
  paid: 'تم الدفع',
  failed: 'فشل',
  expired: 'منتهي',
  refunded: 'مرتجع',
};

const PAYMENT_STATUS_PILL: Record<string, string> = {
  pending: 'bg-primary-light text-primary-dark',
  paid: 'bg-success text-white',
  failed: 'bg-danger text-white',
  expired: 'bg-danger/80 text-white',
  refunded: 'bg-[#666] text-white',
};

export default async function PaymentsListPage({ searchParams }: Props) {
  const ctx = await requireAdmin();
  const params = await searchParams;
  const statusFilter = params.status;
  const search = params.q?.trim() ?? '';

  const supa = await createClient();

  let q = supa
    .from('orders')
    .select(
      'id, order_number, student_id, total, payment_status, payment_method_detail, fawry_ref_number, merchant_ref_number, status, payment_expires_at, payment_paid_at, created_at, branch_id'
    )
    .eq('payment_method', 'fawry')
    .order('created_at', { ascending: false })
    .limit(100);

  if (ctx.role === 'branch_manager' && ctx.branchId) q = q.eq('branch_id', ctx.branchId);
  if (statusFilter && statusFilter !== 'all') q = q.eq('payment_status', statusFilter);
  if (search) {
    // Match against either the human order_number or the Fawry refs.
    q = q.or(
      `order_number.ilike.%${search}%,fawry_ref_number.ilike.%${search}%,merchant_ref_number.ilike.%${search}%`
    );
  }

  const { data: orders } = await q;

  return (
    <PageShell
      title="دفعات فوري"
      subtitle="عرض جميع طلبات الدفع الإلكتروني وسجل أحداث كل طلب"
    >
      <form className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="ابحث برقم الطلب أو الرقم المرجعي"
          className="input"
        />
        <select name="status" defaultValue={statusFilter ?? 'all'} className="input">
          <option value="all">كل الحالات</option>
          {Object.keys(PAYMENT_STATUS_LABEL).map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-light text-right">
            <tr>
              <th className="px-4 py-3 font-bold">رقم الطلب</th>
              <th className="px-4 py-3 font-bold">المبلغ</th>
              <th className="px-4 py-3 font-bold">حالة الدفع</th>
              <th className="px-4 py-3 font-bold">طريقة الدفع</th>
              <th className="px-4 py-3 font-bold">الرقم المرجعي</th>
              <th className="px-4 py-3 font-bold">التاريخ</th>
              <th className="px-4 py-3 font-bold w-12"></th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="border-t border-bg-light">
                <td className="px-4 py-3 font-bold text-accent-dark">{o.order_number ?? '—'}</td>
                <td className="px-4 py-3">{formatPrice(Number(o.total))}</td>
                <td className="px-4 py-3">
                  <span
                    className={`${
                      PAYMENT_STATUS_PILL[o.payment_status] ?? 'bg-bg-light'
                    } px-2.5 py-1 rounded-pill text-xs font-bold whitespace-nowrap`}
                  >
                    {PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#666]">{o.payment_method_detail ?? '—'}</td>
                <td className="px-4 py-3 text-[#666] font-mono text-xs" dir="ltr">
                  {o.fawry_ref_number ?? '—'}
                </td>
                <td className="px-4 py-3 text-[#666] text-xs">
                  {new Date(o.created_at).toLocaleString('ar-EG')}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/payments/${o.id}`}
                    className="text-primary-dark hover:text-accent text-sm font-bold"
                  >
                    تفاصيل
                  </Link>
                </td>
              </tr>
            ))}
            {(orders ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#666]">
                  لا توجد دفعات تطابق البحث.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
