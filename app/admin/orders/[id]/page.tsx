import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import StatusPill from '@/components/admin/status-pill';
import OrderActionsBar from '@/components/admin/order-actions-bar';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';
import type { OrderStatus } from '@/lib/types';

interface Props { params: Promise<{ id: string }> }

export default async function OrderDetailPage({ params }: Props) {
  const ctx = await requireAdmin();
  const { id } = await params;
  const supa = await createClient();

  const { data: order } = await supa
    .from('orders')
    .select(
      'id, order_number, status, total, subtotal, shipping_fee, fulfillment_type, payment_status, payment_method, shipping_governorate, shipping_address, notes, reservation_expires_at, cancelled_at, cancel_reason, created_at, updated_at, branch:branches(id, name_ar, address_ar, phone, whatsapp), student:students(id, full_name, phone, email, governorate, address), items:order_items(quantity, unit_price, book:books(id, title_ar))'
    )
    .eq('id', id)
    .maybeSingle();

  if (!order) notFound();

  // Branch managers can only view orders for their branch
  if (ctx.role === 'branch_manager' && (order as any).branch?.id !== ctx.branchId) {
    notFound();
  }

  return (
    <PageShell
      title={`الطلب ${order.order_number}`}
      subtitle={new Date(order.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
      actions={
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/orders/${order.id}/invoice`}
            target="_blank"
            className="btn bg-white text-primary-dark hover:bg-bg-light px-4 py-2 text-sm"
          >
            <i className="fa-solid fa-print ml-2" />
            طباعة فاتورة
          </Link>
          <StatusPill status={order.status as OrderStatus} />
        </div>
      }
    >
      <div className="grid lg:grid-cols-[1fr_360px] gap-4 sm:gap-6">
        <div className="space-y-5">
          <OrderActionsBar orderId={order.id} status={order.status as OrderStatus} />

          {order.cancel_reason && (
            <div className="card p-4 bg-danger/5 border-r-4 border-danger">
              <strong className="text-danger">سبب الإلغاء:</strong> {order.cancel_reason}
            </div>
          )}

          {/* Items */}
          <div className="card p-5">
            <h3 className="font-bold text-primary-dark mb-4">الكتب المطلوبة</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-[#666] border-b border-bg-light">
                <tr>
                  <th className="text-right py-2">الكتاب</th>
                  <th className="text-right py-2">السعر</th>
                  <th className="text-right py-2">الكمية</th>
                  <th className="text-left py-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(order as any).items.map((it: any, i: number) => (
                  <tr key={i} className="border-b border-bg-light last:border-0">
                    <td className="py-3">
                      <Link href={`/admin/books`} className="hover:text-primary">
                        {it.book.title_ar}
                      </Link>
                    </td>
                    <td className="py-3">{formatPrice(Number(it.unit_price))}</td>
                    <td className="py-3">{it.quantity}</td>
                    <td className="py-3 text-left font-bold">{formatPrice(Number(it.unit_price) * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-bg-light mt-4 pt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-[#666]">المجموع</span><span className="font-bold">{formatPrice(Number(order.subtotal))}</span></div>
              <div className="flex justify-between"><span className="text-[#666]">الشحن</span><span className="font-bold">{Number(order.shipping_fee) === 0 ? 'مجاني' : formatPrice(Number(order.shipping_fee))}</span></div>
              <div className="flex justify-between text-lg pt-2 mt-2 border-t border-bg-light"><span className="font-bold">الإجمالي</span><span className="font-extrabold text-accent-dark">{formatPrice(Number(order.total))}</span></div>
            </div>
          </div>

          {order.notes && (
            <div className="card p-5">
              <h3 className="font-bold text-primary-dark mb-2">ملاحظات الطالب</h3>
              <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          {/* Student info */}
          <div className="card p-5">
            <h3 className="font-bold text-primary-dark mb-3">بيانات الطالب</h3>
            <dl className="text-sm space-y-2">
              <div><dt className="text-[#666] text-xs">الاسم</dt><dd className="font-bold">{(order as any).student?.full_name ?? '—'}</dd></div>
              <div><dt className="text-[#666] text-xs">الموبايل</dt><dd dir="ltr">{(order as any).student?.phone ?? '—'}</dd></div>
              <div><dt className="text-[#666] text-xs">الإيميل</dt><dd className="text-xs" dir="ltr">{(order as any).student?.email ?? '—'}</dd></div>
            </dl>
            <a
              href={`https://wa.me/${(order as any).student?.phone?.replace(/\D/g, '').replace(/^0/, '20') ?? ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline w-full mt-4 text-sm"
            >
              <i className="fa-brands fa-whatsapp ml-2" />
              تواصل واتساب
            </a>
          </div>

          {/* Fulfillment */}
          <div className="card p-5">
            <h3 className="font-bold text-primary-dark mb-3">
              {order.fulfillment_type === 'pickup' ? 'الاستلام من الفرع' : 'التوصيل'}
            </h3>
            {order.fulfillment_type === 'pickup' ? (
              <div className="text-sm">
                <p className="font-bold mb-1">{(order as any).branch?.name_ar}</p>
                <p className="text-[#666]">{(order as any).branch?.address_ar}</p>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <p><strong>المحافظة:</strong> {order.shipping_governorate}</p>
                <p className="text-[#666]">{order.shipping_address}</p>
              </div>
            )}
            {order.reservation_expires_at && order.status === 'pending' && (
              <p className="text-xs text-accent-dark mt-3 bg-accent/10 p-2 rounded-s">
                ⏰ الحجز ينتهي في {new Date(order.reservation_expires_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
          </div>

          {/* Payment */}
          <div className="card p-5">
            <h3 className="font-bold text-primary-dark mb-3">الدفع</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between"><dt className="text-[#666]">الطريقة</dt><dd className="font-bold">{order.payment_method === 'cod' ? 'كاش عند الاستلام' : order.payment_method}</dd></div>
              <div className="flex justify-between"><dt className="text-[#666]">الحالة</dt><dd className="font-bold">{order.payment_status === 'paid' ? '✅ مدفوع' : '⏳ غير مدفوع'}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
