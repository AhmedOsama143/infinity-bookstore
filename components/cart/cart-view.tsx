'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from './cart-provider';
import { fallbackCover, formatPrice } from '@/lib/utils';

interface Props {
  freeShippingThreshold: number;
  isSignedIn: boolean;
  alreadyOrdered: number;
  cap: number;
}

export default function CartView({ freeShippingThreshold, isSignedIn, alreadyOrdered, cap }: Props) {
  const { items, subtotal, totalItems, setQuantity, remove, isHydrated } = useCart();

  if (!isHydrated) {
    return (
      <div className="text-center text-[#666] py-16">
        <i className="fa-solid fa-spinner fa-spin text-3xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <i className="fa-solid fa-cart-shopping text-5xl text-primary-light mb-4 block" />
        <h2 className="text-xl font-bold mb-2">السلة فارغة</h2>
        <p className="text-[#666] mb-2">✨ أضف كتبًا بقيمة {freeShippingThreshold} جنيه واستمتع بالشحن المجاني</p>
        <Link href="/books" className="btn btn-primary mt-4">تصفح الكتب</Link>
      </div>
    );
  }

  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const shippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);
  const wouldExceedCap = alreadyOrdered + totalItems > cap;
  const overCapBy = alreadyOrdered + totalItems - cap;

  return (
    <div className="grid lg:grid-cols-[1fr_350px] gap-6 lg:gap-8 items-start">
      {/* Items */}
      <div className="space-y-3 sm:space-y-4">
        {items.map((item) => (
          <div key={item.book_id} className="card p-3 sm:p-5">
            <div className="flex gap-3 sm:gap-4 items-start">
              <div className="relative w-16 h-22 sm:w-20 sm:h-28 bg-bg-light rounded-s overflow-hidden flex-shrink-0">
                <Image
                  src={item.cover_url ?? fallbackCover(item.title_ar)}
                  alt={item.title_ar}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized={!item.cover_url || item.cover_url.startsWith('data:')}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/books/${item.book_id}`} className="font-bold hover:text-primary block line-clamp-2 text-sm sm:text-base">
                    {item.title_ar}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(item.book_id)}
                    aria-label="إزالة"
                    className="text-danger hover:opacity-70 px-1 shrink-0"
                  >
                    <i className="fa-solid fa-trash text-xs sm:text-sm" />
                  </button>
                </div>
                {item.teacher_name && (
                  <p className="text-xs text-[#888] mt-0.5">{item.teacher_name}</p>
                )}
                <p className="text-accent-dark font-bold mt-1 text-sm">{formatPrice(item.unit_price)}</p>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.book_id, item.quantity - 1)}
                      aria-label="أنقص الكمية"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-[#ddd] hover:border-primary hover:text-primary transition-colors text-sm"
                    >
                      −
                    </button>
                    <span className="font-bold min-w-[24px] text-center text-sm">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.book_id, item.quantity + 1)}
                      aria-label="زد الكمية"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-[#ddd] hover:border-primary hover:text-primary transition-colors text-sm"
                    >
                      +
                    </button>
                  </div>
                  <div className="font-extrabold text-primary-dark text-sm sm:text-base">
                    {formatPrice(item.quantity * item.unit_price)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <aside className="card p-6 sticky top-24">
        <h2 className="text-lg font-extrabold text-primary-dark mb-4">ملخص الطلب</h2>

        {/* Free-shipping progress bar */}
        <div className="mb-5">
          {remainingForFreeShipping > 0 ? (
            <>
              <p className="text-sm text-primary-dark mb-2">
                أضف <span className="font-bold">{formatPrice(remainingForFreeShipping)}</span> لتحصل على شحن مجاني! 🚚
              </p>
              <div className="h-2 bg-bg-light rounded-pill overflow-hidden">
                <div
                  className="h-full bg-accent rounded-pill transition-all"
                  style={{ width: `${shippingProgress}%` }}
                />
              </div>
            </>
          ) : (
            <div className="bg-success/10 border border-success/30 text-success font-bold text-sm p-3 rounded-s text-center">
              🎉 تهانينا! شحنك مجاني
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm mb-4 pb-4 border-b border-bg-light">
          <div className="flex justify-between">
            <span className="text-[#666]">المجموع ({totalItems} كتاب)</span>
            <span className="font-bold">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#666]">الشحن</span>
            <span className="text-[#666]">يُحسب عند الدفع</span>
          </div>
        </div>
        <div className="flex justify-between items-baseline mb-6">
          <span className="font-bold">الإجمالي</span>
          <span className="text-2xl font-extrabold text-accent-dark">{formatPrice(subtotal)}</span>
        </div>

        {/* Cap warning */}
        {wouldExceedCap && (
          <div className="bg-danger/10 border border-danger/30 text-danger text-sm p-3 rounded-s mb-4">
            <strong>تجاوزت الحد الأقصى!</strong><br />
            لديك {alreadyOrdered} كتاب في طلبات سابقة. الحد الأقصى {cap} كتب، وتحتاج لإزالة {overCapBy} من السلة.
          </div>
        )}

        {isSignedIn ? (
          <Link
            href="/checkout"
            className={`btn btn-primary w-full py-3 text-base text-center ${wouldExceedCap ? 'opacity-50 pointer-events-none' : ''}`}
          >
            متابعة للدفع
            <i className="fa-solid fa-arrow-left mr-2" />
          </Link>
        ) : (
          <Link
            href="/login?next=/checkout"
            className="btn btn-primary w-full py-3 text-base text-center"
          >
            سجّل الدخول للمتابعة
          </Link>
        )}

        <Link href="/books" className="block text-center mt-4 text-primary hover:text-primary-dark text-sm">
          ← متابعة التسوق
        </Link>

        <div className="mt-6 pt-4 border-t border-bg-light text-xs text-[#666] space-y-1">
          <p>💡 الكتب محجوزة لمدة ٢٤ ساعة في الفرع بعد تأكيد الطلب</p>
          <p>💰 يمكنك الدفع عند الاستلام (كاش)</p>
        </div>
      </aside>
    </div>
  );
}
