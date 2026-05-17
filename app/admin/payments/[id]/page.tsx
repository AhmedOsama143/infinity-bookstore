import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import StatusPill from '@/components/admin/status-pill';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';
import PaymentActions from '@/components/admin/payment-actions';
import type { OrderStatus } from '@/lib/types';

export const metadata = { title: 'تفاصيل الدفعة | لوحة الإدارة' };

interface Props {
  params: Promise<{ id: string }>;
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'قيد التأكيد',
  paid: 'تم الدفع',
  failed: 'فشل',
  expired: 'منتهي',
  refunded: 'مرتجع',
};

const EVENT_LABEL: Record<string, string> = {
  webhook: 'إشعار من فوري',
  status_poll: 'استعلام يدوي / تلقائي',
  cron_expired: 'إلغاء تلقائي (انتهاء الصلاحية)',
  expire_failed: 'فشل الإلغاء التلقائي',
  cron_error: 'خطأ في المهمة المجدولة',
  refund: 'استرداد',
};

export default async function PaymentDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const supa = await createClient();

  const { data: order } = await supa
    .from('orders')
    .select(
      'id, order_number, student_id, total, subtotal, shipping_fee, payment_amount, fawry_fees, payment_status, payment_method, payment_method_detail, fawry_ref_number, merchant_ref_number, status, payment_expires_at, payment_paid_at, created_at, branch_id, items:order_items(book_id, quantity, unit_price, book:books(title_ar))'
    )
    .eq('id', id)
    .maybeSingle();
  if (!order) notFound();

  const { data: events } = await supa
    .from('payment_events')
    .select(
      'id, event_type, fawry_status_code, signature_valid, processed, error_message, raw_payload, created_at'
    )
    .eq('merchant_ref_number', order.merchant_ref_number ?? order.id)
    .order('created_at', { ascending: false });

  const payAmount = Number(order.payment_amount ?? 0);
  const fawryFees = Number(order.fawry_fees ?? 0);
  const isRefundable = order.payment_status === 'paid';

  return (
    <PageShell
      title={`دفعة ${order.order_number ?? order.id}`}
      subtitle="عرض جميع أحداث الدفع وتفاصيل الطلب"
      actions={
        <Link href="/admin/payments" className="text-white/90 hover:text-white text-sm">
          <i className="fa-solid fa-arrow-right ml-1" />
          العودة للقائمة
        </Link>
      }
    >
      {/* Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        <div className="card p-5">
          <h2 className="font-bold mb-4 text-primary-dark">ملخص الطلب</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-[#666]">رقم الطلب</dt>
            <dd className="font-bold">{order.order_number ?? '—'}</dd>

            <dt className="text-[#666]">حالة الطلب</dt>
            <dd>
              <StatusPill status={order.status as OrderStatus} />
            </dd>

            <dt className="text-[#666]">حالة الدفع</dt>
            <dd className="font-bold">
              {PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
            </dd>

            <dt className="text-[#666]">طريقة الدفع</dt>
            <dd>{order.payment_method_detail ?? '—'}</dd>

            <dt className="text-[#666]">إجمالي الطلب</dt>
            <dd className="font-bold">{formatPrice(Number(order.total))}</dd>

            <dt className="text-[#666]">المبلغ المدفوع</dt>
            <dd>{payAmount > 0 ? formatPrice(payAmount) : '—'}</dd>

            {fawryFees > 0 && (
              <>
                <dt className="text-[#666]">رسوم فوري</dt>
                <dd>{formatPrice(fawryFees)}</dd>
              </>
            )}

            <dt className="text-[#666]">الرقم المرجعي للتاجر</dt>
            <dd className="text-xs font-mono" dir="ltr">
              {order.merchant_ref_number ?? order.id}
            </dd>

            <dt className="text-[#666]">الرقم المرجعي فوري</dt>
            <dd className="text-xs font-mono" dir="ltr">
              {order.fawry_ref_number ?? '—'}
            </dd>

            <dt className="text-[#666]">أُنشئ في</dt>
            <dd className="text-xs">{new Date(order.created_at).toLocaleString('ar-EG')}</dd>

            {order.payment_paid_at && (
              <>
                <dt className="text-[#666]">دُفع في</dt>
                <dd className="text-xs">
                  {new Date(order.payment_paid_at).toLocaleString('ar-EG')}
                </dd>
              </>
            )}

            {order.payment_expires_at && (
              <>
                <dt className="text-[#666]">ينتهي في</dt>
                <dd className="text-xs">
                  {new Date(order.payment_expires_at).toLocaleString('ar-EG')}
                </dd>
              </>
            )}
          </dl>
        </div>

        <PaymentActions
          orderId={order.id}
          merchantRefNumber={order.merchant_ref_number ?? order.id}
          fawryRefNumber={order.fawry_ref_number}
          paymentStatus={order.payment_status}
          paymentAmount={payAmount || Number(order.total)}
          canRefund={isRefundable}
        />
      </div>

      {/* Items */}
      <div className="card p-5 mb-5">
        <h2 className="font-bold mb-3 text-primary-dark">عناصر الطلب</h2>
        <table className="w-full text-sm">
          <thead className="text-right text-[#666]">
            <tr>
              <th className="py-2 font-bold">الكتاب</th>
              <th className="py-2 font-bold">الكمية</th>
              <th className="py-2 font-bold">سعر الوحدة</th>
              <th className="py-2 font-bold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {((order as any).items ?? []).map((it: any, idx: number) => {
              const book = Array.isArray(it.book) ? it.book[0] : it.book;
              const lineTotal = Number(it.unit_price) * it.quantity;
              return (
                <tr key={idx} className="border-t border-bg-light">
                  <td className="py-2">{book?.title_ar ?? `#${it.book_id}`}</td>
                  <td className="py-2">{it.quantity}</td>
                  <td className="py-2">{formatPrice(Number(it.unit_price))}</td>
                  <td className="py-2 font-bold">{formatPrice(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Event timeline */}
      <div className="card p-5">
        <h2 className="font-bold mb-4 text-primary-dark">سجل الأحداث</h2>
        <ol className="space-y-3">
          {(events ?? []).map((e) => {
            const ok = e.signature_valid !== false && !e.error_message;
            return (
              <li
                key={e.id}
                className={`border-r-2 pr-3 ${ok ? 'border-success' : 'border-danger'}`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-bold text-sm">
                    {EVENT_LABEL[e.event_type] ?? e.event_type}
                  </span>
                  {e.fawry_status_code && (
                    <span className="px-2 py-0.5 rounded-pill text-xs bg-bg-light font-mono" dir="ltr">
                      {e.fawry_status_code}
                    </span>
                  )}
                  {e.signature_valid === false && (
                    <span className="px-2 py-0.5 rounded-pill text-xs bg-danger text-white">
                      توقيع غير صالح
                    </span>
                  )}
                  {!e.processed && (
                    <span className="px-2 py-0.5 rounded-pill text-xs bg-accent text-white">
                      لم تتم المعالجة
                    </span>
                  )}
                  <span className="text-xs text-[#666] mr-auto">
                    {new Date(e.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>
                {e.error_message && (
                  <div className="text-xs text-danger mt-1">{e.error_message}</div>
                )}
                <details className="mt-2 text-xs text-[#666]">
                  <summary className="cursor-pointer hover:text-ink">عرض الحمولة الخام</summary>
                  <pre className="mt-2 bg-bg-light p-3 rounded-s overflow-x-auto text-[10px] leading-relaxed" dir="ltr">
                    {JSON.stringify(e.raw_payload, null, 2)}
                  </pre>
                </details>
              </li>
            );
          })}
          {(events ?? []).length === 0 && (
            <li className="text-center text-[#666] py-6 text-sm">
              لم يتم تسجيل أحداث لهذه الدفعة بعد.
            </li>
          )}
        </ol>
      </div>
    </PageShell>
  );
}
