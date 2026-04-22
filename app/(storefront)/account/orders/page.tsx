import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';

export const metadata = { title: 'طلباتي | مكتبة إنفينيتي' };

const statusLabelAr: Record<OrderStatus, string> = {
  pending: 'قيد المراجعة',
  confirmed: 'مؤكد',
  ready: 'جاهز للاستلام',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};
const statusClass: Record<OrderStatus, string> = {
  pending: 'bg-primary-light text-primary-dark',
  confirmed: 'bg-accent text-white',
  ready: 'bg-success text-white',
  completed: 'bg-success text-white',
  cancelled: 'bg-danger text-white',
};

export default async function OrdersPage() {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  const { data: orders } = await supa
    .from('orders')
    .select('id, order_number, status, total, shipping_fee, fulfillment_type, created_at, branch:branches(name_ar)')
    .eq('student_id', user!.id)
    .order('created_at', { ascending: false });

  if (!orders || orders.length === 0) {
    return (
      <div className="card p-12 text-center">
        <i className="fa-regular fa-bag-shopping text-5xl text-primary-light mb-4 block" />
        <h2 className="text-xl font-bold mb-2">لا توجد طلبات بعد</h2>
        <p className="text-[#666] mb-6">ابدأ تسوّق الكتب من متجرنا</p>
        <Link href="/books" className="btn btn-primary">تصفح الكتب</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((o: any) => (
        <Link
          key={o.id}
          href={`/account/orders/${o.id}`}
          className="card card-hover p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <div className="font-bold text-primary-dark">{o.order_number}</div>
            <div className="text-xs text-[#666]">
              {new Date(o.created_at).toLocaleDateString('ar-EG', { dateStyle: 'medium' })} —{' '}
              {o.fulfillment_type === 'pickup' ? `استلام من ${o.branch?.name_ar}` : 'توصيل'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-pill text-xs font-bold ${statusClass[o.status as OrderStatus]}`}>
              {statusLabelAr[o.status as OrderStatus]}
            </span>
            <span className="font-extrabold text-accent-dark text-lg">
              {formatPrice(o.total)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
