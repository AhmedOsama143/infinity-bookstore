import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { fallbackCover, formatPrice } from '@/lib/utils';
import type { OrderStatus, PaymentStatus, PaymentMethod } from '@/lib/types';
import ReturnRequestForm from '@/components/account/return-request-form';

export const metadata = { title: 'طلباتي ومدفوعاتي | مكتبة إنفينيتي' };

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

const paymentStatusLabelAr: Record<PaymentStatus, string> = {
  pending: 'بانتظار الدفع',
  paid: 'مدفوع',
  failed: 'فشل الدفع',
  refunded: 'تم الاسترداد',
};
const paymentStatusClass: Record<PaymentStatus, string> = {
  pending: 'text-[#888]',
  paid: 'text-success',
  failed: 'text-danger',
  refunded: 'text-primary-dark',
};

const paymentMethodLabelAr: Record<PaymentMethod, string> = {
  cod: 'الدفع عند الاستلام',
  card: 'بطاقة ائتمان',
  wallet: 'محفظة إلكترونية',
  fawry: 'فوري',
  instapay: 'إنستاباي',
  bank_transfer: 'تحويل بنكي',
};

const PIPELINE: OrderStatus[] = ['pending', 'confirmed', 'ready', 'completed'];

function StatusTimeline({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-danger text-sm">
        <i className="fa-solid fa-circle-xmark" />
        <span>تم إلغاء هذا الطلب</span>
      </div>
    );
  }
  const currentIdx = PIPELINE.indexOf(status);
  return (
    <ol className="flex items-center gap-1 sm:gap-2 text-[0.7rem]">
      {PIPELINE.map((step, idx) => {
        const reached = idx <= currentIdx;
        return (
          <li key={step} className="flex items-center gap-1 sm:gap-2 flex-1">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                reached
                  ? 'bg-primary text-white'
                  : 'bg-bg-light text-[#aaa] border border-[#e0e0e0]'
              }`}
            >
              {reached ? <i className="fa-solid fa-check" /> : idx + 1}
            </span>
            <span
              className={`hidden sm:inline ${
                reached ? 'text-primary-dark font-bold' : 'text-[#999]'
              }`}
            >
              {statusLabelAr[step]}
            </span>
            {idx < PIPELINE.length - 1 && (
              <span
                className={`flex-1 h-0.5 ${reached && idx < currentIdx ? 'bg-primary' : 'bg-bg-light'}`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface OrderItemRow {
  quantity: number;
  unit_price: number;
  subtotal: number;
  book: {
    id: number;
    title_ar: string;
    cover_url: string | null;
    teacher: { name_ar: string } | null;
  } | null;
}

interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  fulfillment_type: 'pickup' | 'delivery';
  shipping_governorate: string | null;
  shipping_address: string | null;
  shipping_fee: number;
  subtotal: number;
  total: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  notes: string | null;
  created_at: string;
  branch: { name_ar: string } | null;
  order_items: OrderItemRow[];
}

export default async function OrdersPage() {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  const { data } = await supa
    .from('orders')
    .select(
      `id, order_number, status, fulfillment_type, shipping_governorate, shipping_address,
       shipping_fee, subtotal, total, payment_status, payment_method, notes, created_at,
       branch:branches(name_ar),
       order_items(quantity, unit_price, subtotal,
         book:books(id, title_ar, cover_url, teacher:teachers(name_ar)))`
    )
    .eq('student_id', user!.id)
    .order('created_at', { ascending: false });

  const orders = (data ?? []) as unknown as OrderRow[];

  const totalSpent = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total), 0);
  const ordersCount = orders.length;
  const activeCount = orders.filter((o) =>
    ['pending', 'confirmed', 'ready'].includes(o.status)
  ).length;

  if (orders.length === 0) {
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
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card p-3 sm:p-4 text-center">
          <div className="text-[10px] sm:text-xs text-[#666] mb-1">إجمالي الطلبات</div>
          <div className="text-lg sm:text-2xl font-extrabold text-primary-dark">{ordersCount}</div>
        </div>
        <div className="card p-3 sm:p-4 text-center">
          <div className="text-[10px] sm:text-xs text-[#666] mb-1">قيد التنفيذ</div>
          <div className="text-lg sm:text-2xl font-extrabold text-accent-dark">{activeCount}</div>
        </div>
        <div className="card p-3 sm:p-4 text-center">
          <div className="text-[10px] sm:text-xs text-[#666] mb-1">إجمالي المدفوع</div>
          <div className="text-lg sm:text-2xl font-extrabold text-primary-dark">
            {formatPrice(totalSpent)}
          </div>
        </div>
      </div>

      {orders.map((o) => {
        const canReturn = ['ready', 'completed'].includes(o.status);
        const itemsCount = o.order_items.reduce((s, i) => s + i.quantity, 0);
        return (
          <article key={o.id} className="card p-5 space-y-4">
            {/* Header */}
            <header className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-bg-light">
              <div>
                <div className="font-extrabold text-primary-dark text-lg">
                  {o.order_number}
                </div>
                <div className="text-xs text-[#666] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    <i className="fa-regular fa-calendar ml-1" />
                    {new Date(o.created_at).toLocaleDateString('ar-EG', {
                      dateStyle: 'medium',
                    })}
                  </span>
                  <span>
                    <i className="fa-solid fa-box ml-1" />
                    {itemsCount} {itemsCount === 1 ? 'كتاب' : 'كتب'}
                  </span>
                  <span>
                    {o.fulfillment_type === 'pickup' ? (
                      <>
                        <i className="fa-solid fa-store ml-1" />
                        استلام من {o.branch?.name_ar}
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-truck ml-1" />
                        توصيل إلى {o.shipping_governorate}
                      </>
                    )}
                  </span>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-pill text-xs font-bold whitespace-nowrap ${
                  statusClass[o.status]
                }`}
              >
                {statusLabelAr[o.status]}
              </span>
            </header>

            {/* Status timeline */}
            <div className="px-1">
              <StatusTimeline status={o.status} />
            </div>

            {/* Items */}
            <ul className="divide-y divide-bg-light">
              {o.order_items.map((it, idx) => {
                const cover = it.book?.cover_url ?? fallbackCover(it.book?.title_ar ?? '');
                return (
                  <li key={idx} className="flex items-center gap-3 py-3">
                    <Link
                      href={it.book ? `/books/${it.book.id}` : '#'}
                      className="relative w-12 h-16 bg-bg-light rounded-s overflow-hidden flex-shrink-0"
                    >
                      <Image
                        src={cover}
                        alt={it.book?.title_ar ?? ''}
                        fill
                        className="object-cover"
                        sizes="48px"
                        unoptimized={cover.startsWith('data:')}
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={it.book ? `/books/${it.book.id}` : '#'}
                        className="font-bold text-sm hover:text-primary line-clamp-1 transition-colors"
                      >
                        {it.book?.title_ar ?? 'كتاب محذوف'}
                      </Link>
                      {it.book?.teacher && (
                        <div className="text-xs text-[#888] line-clamp-1">
                          {it.book.teacher.name_ar}
                        </div>
                      )}
                      <div className="text-xs text-[#666] mt-1">
                        {it.quantity} × {formatPrice(Number(it.unit_price))}
                      </div>
                    </div>
                    <div className="font-bold text-accent-dark whitespace-nowrap">
                      {formatPrice(Number(it.subtotal))}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Totals + payment */}
            <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-bg-light">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#666]">المجموع الفرعي</span>
                  <span className="font-bold">{formatPrice(Number(o.subtotal))}</span>
                </div>
                {Number(o.shipping_fee) > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-[#666]">الشحن</span>
                    <span className="font-bold">{formatPrice(Number(o.shipping_fee))}</span>
                  </div>
                ) : o.fulfillment_type === 'delivery' ? (
                  <div className="flex justify-between">
                    <span className="text-[#666]">الشحن</span>
                    <span className="font-bold text-success">مجاني</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-2 border-t border-bg-light">
                  <span className="font-bold text-primary-dark">الإجمالي</span>
                  <span className="font-extrabold text-accent-dark text-lg">
                    {formatPrice(Number(o.total))}
                  </span>
                </div>
              </div>

              <div className="bg-bg-light rounded-s p-3 text-sm">
                <div className="text-xs text-[#666] mb-1">طريقة الدفع</div>
                <div className="font-bold mb-2">
                  <i className="fa-solid fa-wallet ml-1 text-primary" />
                  {paymentMethodLabelAr[o.payment_method]}
                </div>
                <div className="text-xs text-[#666] mb-1">حالة الدفع</div>
                <div className={`font-bold ${paymentStatusClass[o.payment_status]}`}>
                  <i
                    className={`ml-1 ${
                      o.payment_status === 'paid'
                        ? 'fa-solid fa-circle-check'
                        : o.payment_status === 'failed'
                          ? 'fa-solid fa-circle-xmark'
                          : 'fa-regular fa-clock'
                    }`}
                  />
                  {paymentStatusLabelAr[o.payment_status]}
                </div>
              </div>
            </div>

            {o.notes && (
              <div className="text-xs text-[#666] pt-3 border-t border-bg-light">
                <span className="font-bold">ملاحظاتك:</span> {o.notes}
              </div>
            )}

            {canReturn && (
              <div className="pt-3 border-t border-bg-light">
                <ReturnRequestForm orderId={o.id} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
