import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'تم تأكيد طلبك | مكتبة إنفينيتي' };

interface Props { params: Promise<{ id: string }> }

export default async function OrderSuccessPage({ params }: Props) {
  const { id } = await params;
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login');

  const { data: order } = await supa
    .from('orders')
    .select(
      'id, order_number, status, total, subtotal, shipping_fee, fulfillment_type, shipping_address, shipping_governorate, created_at, notes, branch:branches(name_ar, address_ar, phone, whatsapp), items:order_items(quantity, unit_price, book:books(id, title_ar))'
    )
    .eq('id', id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (!order) notFound();

  return (
    <section className="section">
      <div className="container-app max-w-3xl">
        <div className="card p-8 text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4 text-4xl">
            <i className="fa-solid fa-check" />
          </div>
          <h1 className="text-3xl font-extrabold text-primary-dark mb-2">تم استلام طلبك!</h1>
          <p className="text-[#666]">
            رقم الطلب: <span className="font-bold text-accent-dark text-lg">{order.order_number}</span>
          </p>
          <p className="text-sm text-[#666] mt-3">
            هنراجع طلبك ونتواصل معك قريبًا. محجوز الكتب لمدة ٢٤ ساعة في {(order as any).branch?.name_ar}.
          </p>
        </div>

        <div className="card p-6 mb-4">
          <h2 className="font-bold text-primary-dark mb-4">تفاصيل الطلب</h2>
          <table className="w-full text-sm">
            <tbody>
              {(order as any).items.map((it: any, i: number) => (
                <tr key={i} className="border-b border-bg-light last:border-0">
                  <td className="py-2">
                    <Link href={`/books/${it.book.id}`} className="hover:text-primary">
                      {it.book.title_ar}
                    </Link>
                    <span className="text-[#666] text-xs"> × {it.quantity}</span>
                  </td>
                  <td className="py-2 text-left font-bold">{formatPrice(it.quantity * Number(it.unit_price))}</td>
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

        <div className="card p-6 mb-4">
          <h2 className="font-bold text-primary-dark mb-3">
            {order.fulfillment_type === 'pickup' ? 'عنوان الاستلام' : 'عنوان التوصيل'}
          </h2>
          {order.fulfillment_type === 'pickup' ? (
            <div className="text-sm space-y-2">
              <p className="font-bold">{(order as any).branch?.name_ar}</p>
              <p className="text-[#666]">{(order as any).branch?.address_ar}</p>
              <a
                href={`https://wa.me/${(order as any).branch?.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary font-bold mt-2"
              >
                <i className="fa-brands fa-whatsapp" />
                تواصل مع الفرع
              </a>
            </div>
          ) : (
            <div className="text-sm space-y-1 text-[#666]">
              <p>{order.shipping_governorate}</p>
              <p>{order.shipping_address}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/account/orders" className="btn btn-primary">عرض طلباتي</Link>
          <Link href="/books" className="btn btn-outline">متابعة التسوق</Link>
        </div>
      </div>
    </section>
  );
}
