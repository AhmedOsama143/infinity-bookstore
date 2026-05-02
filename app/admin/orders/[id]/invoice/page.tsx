import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin/auth';

interface Props { params: Promise<{ id: string }> }

// Simple QR-friendly URL — opens the order on click. Uses Google Charts QR
// (free, server-rendered, no client lib). Browsers will print the image.
function qrUrl(text: string, size = 160) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

export default async function InvoicePage({ params }: Props) {
  const ctx = await requireAdmin();
  const { id } = await params;
  const supa = await createClient();

  const { data: order } = await supa
    .from('orders')
    .select(
      'id, order_number, status, total, subtotal, shipping_fee, fulfillment_type, payment_method, payment_status, shipping_governorate, shipping_address, notes, created_at, branch:branches(name_ar, address_ar, phone), student:students(full_name, phone, email), items:order_items(quantity, unit_price, book:books(title_ar))'
    )
    .eq('id', id)
    .maybeSingle();

  if (!order) notFound();
  if (ctx.role === 'branch_manager' && (order as any).branch?.id !== ctx.branchId) notFound();

  const verifyUrl = `https://infinity-bookstore.vercel.app/admin/orders/${order.id}`;

  return (
    <div className="bg-white min-h-screen p-6 md:p-12 print:p-0" dir="rtl">
      {/* Print button (hidden when printing) */}
      <div className="max-w-3xl mx-auto mb-4 print:hidden flex justify-between">
        <a href={`/admin/orders/${order.id}`} className="text-primary hover:text-primary-dark text-sm font-bold">
          ← العودة للطلب
        </a>
        <button
          onClick={() => typeof window !== 'undefined' && window.print()}
          className="btn btn-primary px-6 py-2 text-sm"
        >
          <i className="fa-solid fa-print ml-2" />
          طباعة / حفظ PDF
        </button>
      </div>

      {/* Invoice paper */}
      <article className="max-w-3xl mx-auto bg-white p-8 md:p-12 shadow-card print:shadow-none print:p-0">
        <header className="flex flex-col sm:flex-row items-start justify-between border-b-4 border-primary pb-4 sm:pb-6 mb-4 sm:mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-primary-dark">
              مكتبة <span className="text-accent">إنفينيتي</span>
            </h1>
            <p className="text-sm text-[#666] mt-1">فاتورة طلب — Invoice</p>
          </div>
          <div className="text-left">
            <img src={qrUrl(verifyUrl)} alt="QR" className="w-24 h-24 sm:w-32 sm:h-32 mb-1" />
            <p className="text-[10px] text-[#888]">امسح للتحقق</p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div>
            <h2 className="text-xs text-[#666] mb-1">رقم الطلب</h2>
            <p className="text-2xl font-extrabold text-accent-dark">{order.order_number}</p>
          </div>
          <div>
            <h2 className="text-xs text-[#666] mb-1">التاريخ</h2>
            <p className="font-bold">
              {new Date(order.created_at).toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          </div>
          <div>
            <h2 className="text-xs text-[#666] mb-1">الطالب</h2>
            <p className="font-bold">{(order as any).student?.full_name ?? '—'}</p>
            <p className="text-xs text-[#666]" dir="ltr">{(order as any).student?.phone ?? ''}</p>
          </div>
          <div>
            <h2 className="text-xs text-[#666] mb-1">{order.fulfillment_type === 'pickup' ? 'استلام من' : 'توصيل من'}</h2>
            <p className="font-bold">{(order as any).branch?.name_ar}</p>
            {order.fulfillment_type === 'delivery' && order.shipping_address && (
              <p className="text-xs text-[#666] mt-1">{order.shipping_governorate} — {order.shipping_address}</p>
            )}
          </div>
        </div>

        {/* Items */}
        <table className="w-full text-sm border-y border-bg-light mb-6">
          <thead className="bg-bg-light text-xs">
            <tr>
              <th className="text-right py-2 px-3">الكتاب</th>
              <th className="text-center py-2 px-3 w-16">الكمية</th>
              <th className="text-left py-2 px-3 w-24">السعر</th>
              <th className="text-left py-2 px-3 w-28">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {((order as any).items ?? []).map((it: any, i: number) => (
              <tr key={i} className="border-t border-bg-light">
                <td className="py-3 px-3">{it.book?.title_ar}</td>
                <td className="py-3 px-3 text-center">{it.quantity}</td>
                <td className="py-3 px-3 text-left">{formatPrice(Number(it.unit_price))}</td>
                <td className="py-3 px-3 text-left font-bold">{formatPrice(Number(it.unit_price) * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="ml-auto max-w-xs space-y-1 text-sm mb-6">
          <div className="flex justify-between"><span className="text-[#666]">المجموع</span><span className="font-bold">{formatPrice(Number(order.subtotal))}</span></div>
          <div className="flex justify-between"><span className="text-[#666]">الشحن</span><span className="font-bold">{Number(order.shipping_fee) === 0 ? 'مجاني' : formatPrice(Number(order.shipping_fee))}</span></div>
          <div className="flex justify-between text-lg pt-2 border-t border-primary"><span className="font-bold">الإجمالي</span><span className="font-extrabold text-accent-dark">{formatPrice(Number(order.total))}</span></div>
        </div>

        <div className="text-xs text-[#666] space-y-1 border-t border-bg-light pt-4">
          <p><strong>طريقة الدفع:</strong> {order.payment_method === 'cod' ? 'كاش عند الاستلام' : order.payment_method}</p>
          <p><strong>حالة الدفع:</strong> {order.payment_status === 'paid' ? 'مدفوع ✓' : 'غير مدفوع'}</p>
          {order.notes && <p><strong>ملاحظات:</strong> {order.notes}</p>}
        </div>

        <footer className="mt-8 pt-4 border-t border-bg-light text-center text-xs text-[#888]">
          شكرًا لتسوقك من مكتبة إنفينيتي 🌿
        </footer>
      </article>
    </div>
  );
}
