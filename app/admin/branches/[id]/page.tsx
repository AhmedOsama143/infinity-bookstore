import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import StatusPill from '@/components/admin/status-pill';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';
import type { OrderStatus } from '@/lib/types';

interface Props { params: Promise<{ id: string }> }

export default async function BranchDetailPage({ params }: Props) {
  const ctx = await requireAdmin();
  const { id } = await params;
  const supa = await createClient();

  // Branch managers can only view their own branch
  if (ctx.role === 'branch_manager' && ctx.branchId !== id) notFound();

  const { data: branch } = await supa.from('branches').select('*').eq('id', id).maybeSingle();
  if (!branch) notFound();

  const [revQ, stockQ, recentOrdersQ] = await Promise.all([
    supa.from('orders').select('total, status').eq('branch_id', id).in('status', ['confirmed', 'ready', 'completed']),
    supa
      .from('branch_stock')
      .select('quantity, reserved_quantity, book:books(id, title_ar, final_price, grade_level)')
      .eq('branch_id', id),
    supa
      .from('orders')
      .select('id, order_number, status, total, fulfillment_type, created_at, student:students(full_name)')
      .eq('branch_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const revenue = (revQ.data ?? []).reduce((s, r: any) => s + Number(r.total), 0);
  const totalStock = (stockQ.data ?? []).reduce((s: number, r: any) => s + r.quantity, 0);
  const lowStock = (stockQ.data ?? []).filter((r: any) => r.quantity <= 3).length;

  return (
    <PageShell
      title={branch.name_ar}
      subtitle={branch.address_ar}
      actions={
        <a
          href={`https://wa.me/${branch.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn bg-white text-primary-dark hover:bg-bg-light px-5 py-2 text-sm"
        >
          <i className="fa-brands fa-whatsapp ml-2" />
          واتساب الفرع
        </a>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="الإيرادات" value={formatPrice(revenue)} icon="fa-coins" />
        <Kpi label="إجمالي الطلبات" value={revQ.data?.length ?? 0} icon="fa-bag-shopping" />
        <Kpi label="إجمالي النسخ" value={totalStock} icon="fa-cubes" />
        <Kpi label="مخزون منخفض" value={lowStock} icon="fa-triangle-exclamation" warn={lowStock > 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Inventory */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-primary-dark">المخزون</h2>
            <span className="text-xs text-[#666]">{stockQ.data?.length ?? 0} كتاب</span>
          </div>
          <div className="overflow-y-auto max-h-[480px]">
            <table className="w-full text-sm">
              <thead className="bg-bg-light text-xs sticky top-0">
                <tr>
                  <th className="text-right p-2">الكتاب</th>
                  <th className="text-center p-2">المتاح</th>
                  <th className="text-center p-2">المحجوز</th>
                </tr>
              </thead>
              <tbody>
                {(stockQ.data ?? []).map((r: any, i: number) => {
                  const available = r.quantity - r.reserved_quantity;
                  return (
                    <tr key={i} className="border-b border-bg-light last:border-0">
                      <td className="p-2 truncate max-w-xs">{r.book?.title_ar}</td>
                      <td className={`p-2 text-center font-bold ${available === 0 ? 'text-danger' : available <= 3 ? 'text-accent-dark' : 'text-primary-dark'}`}>
                        {available}
                      </td>
                      <td className="p-2 text-center text-[#666]">{r.reserved_quantity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-primary-dark">أحدث طلبات الفرع</h2>
            <Link href={`/admin/orders?branch=${id}`} className="text-primary text-sm font-bold hover:text-primary-dark">
              عرض الكل ←
            </Link>
          </div>
          {recentOrdersQ.data?.length === 0 ? (
            <p className="text-sm text-[#666] text-center py-6">لا توجد طلبات بعد</p>
          ) : (
            <div className="space-y-2">
              {(recentOrdersQ.data ?? []).map((o: any) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="block p-3 bg-bg-light hover:bg-primary-light rounded-s transition-colors"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-primary">{o.order_number}</span>
                    <StatusPill status={o.status as OrderStatus} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#666] mt-1">
                    <span>{o.student?.full_name ?? '—'} • {o.fulfillment_type === 'pickup' ? 'استلام' : 'توصيل'}</span>
                    <span className="font-bold text-accent-dark">{formatPrice(Number(o.total))}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Kpi({ label, value, icon, warn }: { label: string; value: string | number; icon: string; warn?: boolean }) {
  const color = warn ? 'text-accent-dark' : 'text-primary-dark';
  return (
    <div className="card p-5">
      <i className={`fa-solid ${icon} text-xl ${color} mb-2 block`} />
      <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
      <div className="text-sm text-[#666] mt-1">{label}</div>
    </div>
  );
}
