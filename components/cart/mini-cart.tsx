'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from './cart-provider';
import { fallbackCover, formatPrice } from '@/lib/utils';
import { trackRemoveFromCart } from '@/lib/analytics/gtm';

interface Props {
  freeShippingThreshold: number;
}

// Slide-over cart panel anchored to the right edge (start edge in RTL).
// Opens on a successful add-to-cart and on cart-badge click, so customers
// stay on the page they were browsing. The full /cart page is still
// reachable via the "view full cart" CTA — that's where revalidation,
// quantity edits, and cap warnings live.

export default function MiniCart({ freeShippingThreshold }: Props) {
  const {
    items,
    subtotal,
    totalItems,
    remove,
    isMiniCartOpen,
    closeMiniCart,
  } = useCart();

  // ESC to close + body scroll lock while open. Scroll lock is the strict
  // mobile pattern — without it the page beneath rubber-bands on iOS.
  useEffect(() => {
    if (!isMiniCartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMiniCart();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMiniCartOpen, closeMiniCart]);

  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const shippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  return (
    <>
      <div
        onClick={closeMiniCart}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          isMiniCartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="السلة"
        aria-hidden={!isMiniCartOpen}
        className={`fixed top-0 bottom-0 right-0 z-50 w-full sm:w-[26rem] max-w-full bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out ${
          isMiniCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-bg-light bg-bg-white">
          <h2 className="text-base font-extrabold text-primary-dark">
            <i className="fa-solid fa-cart-shopping ml-2" />
            السلة {totalItems > 0 && <span className="text-[#888] font-bold">({totalItems})</span>}
          </h2>
          <button
            type="button"
            onClick={closeMiniCart}
            aria-label="إغلاق"
            className="text-xl text-[#666] hover:text-primary-dark transition-colors w-8 h-8 flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center text-[#666] py-12">
              <i className="fa-solid fa-cart-shopping text-4xl text-primary-light mb-3 block" />
              <p className="font-bold mb-1">السلة فارغة</p>
              <p className="text-sm">ابدأ بتصفح الكتب وأضف ما يعجبك</p>
              <Link
                href="/books"
                onClick={closeMiniCart}
                className="btn btn-primary text-sm py-2 px-5 mt-5 inline-block"
              >
                تصفح الكتب
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.book_id}
                  className="flex gap-3 pb-3 border-b border-bg-light last:border-0 last:pb-0"
                >
                  <Link
                    href={`/books/${item.book_id}`}
                    onClick={closeMiniCart}
                    className="relative w-12 h-16 bg-bg-light rounded-s overflow-hidden flex-shrink-0"
                  >
                    <Image
                      src={item.cover_url ?? fallbackCover(item.title_ar)}
                      alt={item.title_ar}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized={!item.cover_url || item.cover_url.startsWith('data:')}
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/books/${item.book_id}`}
                      onClick={closeMiniCart}
                      className="font-bold text-sm hover:text-primary line-clamp-2 block"
                    >
                      {item.title_ar}
                    </Link>
                    {item.teacher_name && (
                      <p className="text-xs text-[#888] mt-0.5 line-clamp-1">{item.teacher_name}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-[#666]">× {item.quantity}</span>
                      <span className="font-bold text-accent-dark text-sm">
                        {formatPrice(item.quantity * item.unit_price)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      trackRemoveFromCart(item, item.quantity);
                      remove(item.book_id);
                    }}
                    aria-label="إزالة"
                    className="text-danger hover:opacity-70 flex-shrink-0 self-start p-1"
                  >
                    <i className="fa-solid fa-trash text-xs" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-bg-light p-4 space-y-3 bg-bg-white">
            <div>
              {remainingForFreeShipping > 0 ? (
                <>
                  <p className="text-xs text-primary-dark mb-1.5">
                    أضف <span className="font-bold">{formatPrice(remainingForFreeShipping)}</span> للشحن المجاني 🚚
                  </p>
                  <div className="h-1.5 bg-bg-light rounded-pill overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-pill transition-all"
                      style={{ width: `${shippingProgress}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-success font-bold text-xs text-center bg-success/10 border border-success/30 rounded-s py-1.5">
                  🎉 شحنك مجاني!
                </div>
              )}
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <span className="text-sm text-[#666]">الإجمالي</span>
              <span className="text-xl font-extrabold text-accent-dark">{formatPrice(subtotal)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href="/cart"
                onClick={closeMiniCart}
                className="btn btn-outline text-center text-xs py-2"
              >
                السلة الكاملة
              </Link>
              <Link
                href="/checkout"
                onClick={closeMiniCart}
                className="btn btn-primary text-center text-xs py-2"
              >
                متابعة للدفع
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
