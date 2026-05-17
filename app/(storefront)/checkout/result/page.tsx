import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TrackPurchase from '@/components/analytics/track-purchase';
import ResultStatus from '@/components/checkout/result-status';
import type { OrderStatusSnapshot } from '@/lib/cart/result-actions';

export const metadata = { title: 'نتيجة الدفع | مركز إنفينيتي' };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// The page is a server component that does the initial fetch (so the first
// paint already has the order data — no spinner-then-content flash). The
// client island <ResultStatus /> then takes over for live polling and the
// PAYATFAWRY-specific rendering. Mutating order state from URL params is
// forbidden — the Fawry webhook is the only authoritative source.

export default async function CheckoutResultPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderIdRaw = params.orderId;
  const orderId = Array.isArray(orderIdRaw) ? orderIdRaw[0] : orderIdRaw;
  if (!orderId) notFound();

  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect(`/login?next=/checkout/result?orderId=${encodeURIComponent(orderId)}`);

  const { data: order } = await supa
    .from('orders')
    .select(
      'id, order_number, status, total, subtotal, shipping_fee, payment_status, payment_method, payment_method_detail, fawry_ref_number, fawry_fees, payment_amount, payment_paid_at, payment_expires_at, created_at, items:order_items(book_id, quantity, unit_price, book:books(id, title_ar, teacher:teachers(name_ar)))',
    )
    .eq('id', orderId)
    .eq('student_id', user.id)
    .maybeSingle();

  if (!order) notFound();

  const initialStatus: OrderStatusSnapshot = {
    payment_status: order.payment_status as OrderStatusSnapshot['payment_status'],
    status: order.status,
    payment_method_detail: order.payment_method_detail,
    fawry_ref_number: order.fawry_ref_number,
    payment_paid_at: order.payment_paid_at,
    payment_expires_at: order.payment_expires_at,
  };

  const isPaid = order.payment_status === 'paid';

  return (
    <section className="section">
      {isPaid && (
        <TrackPurchase
          payload={{
            transactionId: order.order_number ?? order.id,
            value: Number(order.total),
            shipping: order.shipping_fee != null ? Number(order.shipping_fee) : undefined,
            paymentType: order.payment_method_detail ?? order.payment_method ?? undefined,
            items: ((order as any).items ?? []).map((it: any) => {
              const book = Array.isArray(it.book) ? it.book[0] : it.book;
              const teacher = book
                ? Array.isArray(book.teacher)
                  ? book.teacher[0]
                  : book.teacher
                : null;
              return {
                book_id: it.book_id,
                title_ar: book?.title_ar ?? '',
                unit_price: Number(it.unit_price),
                quantity: it.quantity,
                teacher_name: teacher?.name_ar ?? null,
              };
            }),
          }}
        />
      )}
      <div className="container-app max-w-2xl">
        <ResultStatus
          orderId={order.id}
          orderNumber={order.order_number ?? order.id}
          total={Number(order.total)}
          fawryFees={order.fawry_fees != null ? Number(order.fawry_fees) : null}
          paymentAmount={order.payment_amount != null ? Number(order.payment_amount) : null}
          initialStatus={initialStatus}
        />
      </div>
    </section>
  );
}
