import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';
import StatusPill from '@/components/admin/status-pill';
import type { OrderStatus, PaymentMethod } from '@/lib/types';

interface Props { searchParams: Promise<{ tab?: 'reservations' | 'payments' }> }

export default async function PaymentsAnalyticsPage({ searchParams }: Props) {
  const ctx = await requireAdmin();
  const params = await searchParams;
  const tab: 'reservations' | 'payments' = params.tab === 'payments' ? 'payments' : 'reservations';
  const supa = await createClient();

  let q = supa.from('orders').select('*');
  if (ctx.role === 'branch_manager' && ctx.branchId) q = q.eq('branch_id', ctx.branchId);
  const { data: allOrders } = await q;

  const { data: branches } = await supa.from('branches').select('id, name_ar');
  const branchName = (id: string) => branches?.find((b) => b.id === id)?.name_ar ?? '—';

  return (
    <PageShell title="الحجوزات والدفعات">
      {/* Tabs */}
      <div className="card p-1 mb-5 inline-flex">
        <Link
          href="/admin/analytics/payments?tab=reservations"
          className={`px-5 py-2 rounded-s text-sm font-bold ${tab === 'reservations' ? 'bg-primary text-white' : 'text-ink hover:bg-bg-light'}`}
        >
          الحجوزات
        </Link>
        <Link
          href="/admin/analytics/payments?tab=payments"
          className={`px-5 py-2 rounded-s text-sm font-bold ${tab === 'payments' ? 'bg-primary text-white' : 'text-ink hover:bg-bg-light'}`}
        >
          الدفعات
        </Link>
      </div>

      {tab === 'reservations'
        ? <Reservations orders={allOrders ?? []} branchName={branchName} branches={branches ?? []} />
        : <Payments orders={allOrders ?? []} branchName={branchName} branches={branches ?? []} />}
    </PageShell>
  );
}

function Reservations({ orders, branchName, branches }: { orders: any[]; branchName: (id: string) => string; branches: any[] }) {
  const reservedOrders = orders.filter((o) => ['pending', 'confirmed', 'ready'].includes(o.status));
  const prepaid = reservedOrders.filter((o) => o.payment_status === 'paid');
  const unpaid = reservedOrders.filter((o) => o.payment_status !== 'paid');

  const perBranch = branches.map((b) => {
    const branchRes = reservedOrders.filter((o) => o.branch_id === b.id);
    return {
      ...b,
      total: branchRes.length,
      paid: branchRes.filter((o) => o.payment_status === 'paid').length,
      unpaid: branchRes.filter((o) => o.payment_status !== 'paid').length,
      value: branchRes.reduce((s, o) => s + Number(o.total), 0),
    };
  });

  // Aging
  const now = Date.now();
  const aging = reservedOrders.map((o) => ({
    ...o,
    age_days: Math.floor((now - new Date(o.created_at).getTime()) / 86400000),
  })).filter((o) => o.age_days >= 1).sort((a, b) => b.age_days - a.age_days).slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Kpi label="إجمالي الحجوزات" value={reservedOrders.length} />
        <Kpi label="حجوزات مدفوعة" value={prepaid.length} highlight />
        <Kpi label="حجوزات غير مدفوعة" value={unpaid.length} />
        <Kpi label="قيمة الحجوزات" value={formatPrice(reservedOrders.reduce((s, o) => s + Number(o.total), 0))} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary-light text-primary-dark text-xs">
            <tr>
              <th className="text-right p-3">الفرع</th>
              <th className="text-center p-3">إجمالي</th>
              <th className="text-center p-3">مدفوع</th>
              <th className="text-center p-3">غير مدفوع</th>
              <th className="text-left p-3">القيمة</th>
            </tr>
          </thead>
          <tbody>
            {perBranch.map((b: any) => (
              <tr key={b.id} className="border-b border-bg-light last:border-0">
                <td className="p-3 font-bold">{b.name_ar}</td>
                <td className="p-3 text-center font-bold">{b.total}</td>
                <td className="p-3 text-center text-success">{b.paid}</td>
                <td className="p-3 text-center text-accent-dark">{b.unpaid}</td>
                <td className="p-3 text-left font-extrabold text-accent-dark">{formatPrice(b.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h3 className="font-bold text-primary-dark mb-4">
          <i className="fa-solid fa-clock-rotate-left ml-2 text-accent-dark" />
          حجوزات قديمة تحتاج متابعة
        </h3>
        {aging.length === 0 ? (
          <p className="text-center text-[#666] py-6 text-sm">لا توجد حجوزات قديمة</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-[#666] border-b border-bg-light">
              <tr>
                <th className="text-right py-2">رقم الطلب</th>
                <th className="text-right py-2">الفرع</th>
                <th className="text-center py-2">العمر (أيام)</th>
                <th className="text-right py-2">الحالة</th>
                <th className="text-left py-2">القيمة</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((o: any) => (
                <tr key={o.id} className="border-b border-bg-light last:border-0">
                  <td className="py-2"><Link href={`/admin/orders/${o.id}`} className="text-primary font-bold">{o.order_number}</Link></td>
                  <td className="py-2 text-xs">{branchName(o.branch_id)}</td>
                  <td className={`py-2 text-center font-bold ${o.age_days >= 3 ? 'text-danger' : 'text-accent-dark'}`}>{o.age_days}</td>
                  <td className="py-2"><StatusPill status={o.status as OrderStatus} /></td>
                  <td className="py-2 text-left font-bold">{formatPrice(Number(o.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Payments({ orders, branchName, branches }: { orders: any[]; branchName: (id: string) => string; branches: any[] }) {
  const settled = orders.filter((o) => ['confirmed', 'ready', 'completed'].includes(o.status));
  const cod = settled.filter((o) => o.payment_method === 'cod');
  const codCollected = cod.filter((o) => o.status === 'completed' || o.payment_status === 'paid');
  const codOutstanding = cod.filter((o) => o.status !== 'completed' && o.payment_status !== 'paid');

  const codPerBranch = branches.map((b) => {
    const branchCod = cod.filter((o) => o.branch_id === b.id);
    const collected = branchCod.filter((o) => o.status === 'completed' || o.payment_status === 'paid');
    return {
      ...b,
      orders: branchCod.length,
      collected_orders: collected.length,
      collected: collected.reduce((s, o) => s + Number(o.total), 0),
      outstanding: branchCod
        .filter((o) => o.status !== 'completed' && o.payment_status !== 'paid')
        .reduce((s, o) => s + Number(o.total), 0),
    };
  });

  // Today's COD by branch
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCod = codCollected.filter((o) => new Date(o.updated_at) >= today);

  return (
    <div className="space-y-8">
      {/* Cross-section summary */}
      <div className="card overflow-hidden">
        <div className="bg-page-header text-white p-4">
          <h2 className="font-bold">الملخص الكلي</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-primary-light text-primary-dark text-xs">
            <tr>
              <th className="text-right p-3">طريقة الدفع</th>
              <th className="text-center p-3">عدد المعاملات</th>
              <th className="text-left p-3">المبلغ</th>
              <th className="text-left p-3">النسبة</th>
            </tr>
          </thead>
          <tbody>
            <Row method="cod" label="كاش (الدفع عند الاستلام)" orders={cod} settledTotal={settled.reduce((s, o) => s + Number(o.total), 0)} />
            <Row method="card" label="بطاقات Visa / Mastercard / Meeza" orders={settled.filter((o) => o.payment_method === 'card')} settledTotal={settled.reduce((s, o) => s + Number(o.total), 0)} />
            <Row method="wallet" label="محافظ موبايل" orders={settled.filter((o) => o.payment_method === 'wallet')} settledTotal={settled.reduce((s, o) => s + Number(o.total), 0)} />
            <Row method="fawry" label="فوري" orders={settled.filter((o) => o.payment_method === 'fawry')} settledTotal={settled.reduce((s, o) => s + Number(o.total), 0)} />
            <tr className="bg-bg-light font-bold">
              <td className="p-3">الإجمالي</td>
              <td className="p-3 text-center">{settled.length}</td>
              <td className="p-3 text-left text-accent-dark">{formatPrice(settled.reduce((s, o) => s + Number(o.total), 0))}</td>
              <td className="p-3 text-left">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section B1 — Cash */}
      <div>
        <h2 className="text-xl font-extrabold text-primary-dark mb-4">
          <i className="fa-solid fa-money-bill-wave ml-2 text-success" />
          الدفع عند الاستلام (كاش)
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
          <Kpi label="إجمالي طلبات COD" value={cod.length} />
          <Kpi label="تم التحصيل" value={codCollected.length} highlight />
          <Kpi label="بانتظار التحصيل" value={codOutstanding.length} warn={codOutstanding.length > 0} />
          <Kpi label="إجمالي المُحَصَّل" value={formatPrice(codCollected.reduce((s, o) => s + Number(o.total), 0))} highlight />
        </div>

        {/* Per-branch cash registers */}
        <div className="card overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead className="bg-primary-light text-primary-dark text-xs">
              <tr>
                <th className="text-right p-3">الفرع (خزينة منفصلة)</th>
                <th className="text-center p-3">طلبات COD</th>
                <th className="text-center p-3">تم التحصيل</th>
                <th className="text-left p-3">المُحَصَّل</th>
                <th className="text-left p-3">المعلّق</th>
              </tr>
            </thead>
            <tbody>
              {codPerBranch.map((b: any) => (
                <tr key={b.id} className="border-b border-bg-light last:border-0">
                  <td className="p-3 font-bold">{b.name_ar}</td>
                  <td className="p-3 text-center">{b.orders}</td>
                  <td className="p-3 text-center text-success font-bold">{b.collected_orders}</td>
                  <td className="p-3 text-left font-extrabold text-success">{formatPrice(b.collected)}</td>
                  <td className="p-3 text-left text-accent-dark">{formatPrice(b.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Daily closing helper */}
        {todayCod.length > 0 && (
          <div className="card p-5 bg-success/5 border-r-4 border-success">
            <h4 className="font-bold text-success mb-2">
              <i className="fa-solid fa-cash-register ml-2" />
              تحصيل اليوم
            </h4>
            <ul className="text-sm space-y-1">
              {branches.map((br) => {
                const branchToday = todayCod.filter((o) => o.branch_id === br.id);
                if (branchToday.length === 0) return null;
                return (
                  <li key={br.id}>
                    <strong>{br.name_ar}:</strong> حُصّل {formatPrice(branchToday.reduce((s, o) => s + Number(o.total), 0))} من {branchToday.length} طلب اليوم
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Section B2 — Online */}
      <div>
        <h2 className="text-xl font-extrabold text-primary-dark mb-4">
          <i className="fa-solid fa-credit-card ml-2 text-primary" />
          الدفع الإلكتروني
        </h2>
        <div className="card p-8 text-center bg-bg-light">
          <i className="fa-solid fa-circle-info text-3xl text-primary mb-3 block" />
          <h3 className="font-bold mb-2">الدفع الإلكتروني سيتم تفعيله في المرحلة القادمة</h3>
          <p className="text-sm text-[#666]">
            بعد دمج بوابة الدفع (Paymob / Fawry) ستظهر هنا بطاقات وفئات الدفع الإلكتروني تلقائيًا.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ method, label, orders, settledTotal }: { method: PaymentMethod; label: string; orders: any[]; settledTotal: number }) {
  const total = orders.reduce((s, o) => s + Number(o.total), 0);
  const pct = settledTotal > 0 ? (total / settledTotal) * 100 : 0;
  return (
    <tr className="border-b border-bg-light">
      <td className="p-3">{label}</td>
      <td className="p-3 text-center">{orders.length}</td>
      <td className="p-3 text-left font-bold">{formatPrice(total)}</td>
      <td className="p-3 text-left text-[#666]">{pct.toFixed(1)}%</td>
    </tr>
  );
}

function Kpi({ label, value, warn, highlight }: { label: string; value: string | number; warn?: boolean; highlight?: boolean }) {
  const cls = warn ? 'text-accent-dark' : highlight ? 'text-success' : 'text-primary-dark';
  return (
    <div className="card p-4">
      <div className={`text-xl font-extrabold ${cls}`}>{value}</div>
      <div className="text-xs text-[#666] mt-1">{label}</div>
    </div>
  );
}
