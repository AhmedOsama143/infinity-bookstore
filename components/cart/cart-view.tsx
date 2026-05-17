'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useCart } from './cart-provider';
import { fallbackCover, formatPrice } from '@/lib/utils';
import { revalidateCart, validateStock } from '@/lib/stock/integrity';
import { trackRemoveFromCart, trackViewCart } from '@/lib/analytics/gtm';

interface Props {
  freeShippingThreshold: number;
  isSignedIn: boolean;
  alreadyOrdered: number;
  cap: number;
}

interface LineNotice {
  book_id: number;
  kind: 'block' | 'adjust' | 'removed';
  message: string;
}

export default function CartView({ freeShippingThreshold, isSignedIn, alreadyOrdered, cap }: Props) {
  const { items, subtotal, totalItems, setQuantity, remove, upsertQuantity, isHydrated } = useCart();
  const [openingNotices, setOpeningNotices] = useState<LineNotice[]>([]);
  const [rowNotices, setRowNotices] = useState<Record<number, LineNotice>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [, startTransition] = useTransition();
  const revalidatedOnce = useRef(false);
  const viewedOnce = useRef(false);

  // Fire view_cart once per mount (after hydration so we have real items).
  useEffect(() => {
    if (!isHydrated) return;
    if (viewedOnce.current) return;
    if (items.length === 0) return;
    viewedOnce.current = true;
    trackViewCart(items, subtotal);
  }, [isHydrated, items, subtotal]);

  // On-mount re-validation: every cart line is verified against live stock.
  // Adjustments and removals are applied before the user can interact.
  useEffect(() => {
    if (!isHydrated) return;
    if (revalidatedOnce.current) return;
    if (items.length === 0) {
      revalidatedOnce.current = true;
      return;
    }
    revalidatedOnce.current = true;
    setIsRevalidating(true);

    const snapshot = items.map((i) => ({ book_id: i.book_id, quantity: i.quantity, title_ar: i.title_ar }));
    revalidateCart(snapshot.map((s) => ({ book_id: s.book_id, quantity: s.quantity })))
      .then((decisions) => {
        const notices: LineNotice[] = [];
        for (const { book_id, decision } of decisions) {
          const titleHint = snapshot.find((s) => s.book_id === book_id)?.title_ar ?? '';
          if (decision.decision === 'allow') continue;
          if (decision.decision === 'block') {
            // Out of stock or delisted — drop the line.
            remove(book_id);
            notices.push({
              book_id,
              kind: 'removed',
              message: decision.user_message ?? `«${titleHint}» لم يعد متاحًا — تمت إزالته من السلة.`,
            });
            continue;
          }
          if (decision.decision === 'adjust') {
            setQuantity(book_id, decision.final_qty);
            notices.push({
              book_id,
              kind: 'adjust',
              message: decision.user_message ?? `تم تعديل كمية «${titleHint}» حسب المتاح.`,
            });
          }
        }
        if (notices.length > 0) setOpeningNotices(notices);
      })
      .catch(() => {
        // Silent — server action will retry on checkout.
      })
      .finally(() => setIsRevalidating(false));
  }, [isHydrated, items, remove, setQuantity]);

  function increment(bookId: number, currentQty: number) {
    const item = items.find((i) => i.book_id === bookId);
    if (!item) return;
    setRowNotices((prev) => {
      const next = { ...prev };
      delete next[bookId];
      return next;
    });
    startTransition(async () => {
      const result = await validateStock({
        actor_type: 'customer',
        action: 'increment',
        book_id: bookId,
        requested_qty: 1,
        current_in_cart: currentQty,
        touchpoint: 'cart_increment',
      });
      if (result.decision === 'allow') {
        upsertQuantity(
          {
            book_id: item.book_id,
            title_ar: item.title_ar,
            cover_url: item.cover_url,
            unit_price: item.unit_price,
            teacher_name: item.teacher_name,
          },
          result.final_qty
        );
        return;
      }
      if (result.decision === 'adjust') {
        upsertQuantity(
          {
            book_id: item.book_id,
            title_ar: item.title_ar,
            cover_url: item.cover_url,
            unit_price: item.unit_price,
            teacher_name: item.teacher_name,
          },
          result.final_qty
        );
        setRowNotices((prev) => ({
          ...prev,
          [bookId]: {
            book_id: bookId,
            kind: 'adjust',
            message: result.user_message ?? 'تم تعديل الكمية حسب المتاح.',
          },
        }));
        return;
      }
      setRowNotices((prev) => ({
        ...prev,
        [bookId]: {
          book_id: bookId,
          kind: 'block',
          message: result.user_message ?? 'لا يمكن إضافة المزيد من هذا الكتاب.',
        },
      }));
    });
  }

  if (!isHydrated || isRevalidating) {
    return (
      <div className="text-center text-[#666] py-16">
        <i className="fa-solid fa-spinner fa-spin text-3xl" />
        {isRevalidating && (
          <p className="mt-3 text-sm">نتأكد من توفر كتبك...</p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <i className="fa-solid fa-cart-shopping text-5xl text-primary-light mb-4 block" />
        <h2 className="text-xl font-bold mb-2">السلة فارغة</h2>
        {openingNotices.length > 0 && (
          <div className="text-sm text-danger mb-4 space-y-1">
            {openingNotices.map((n) => (
              <p key={n.book_id}>{n.message}</p>
            ))}
          </div>
        )}
        <p className="text-[#666] mb-2">✨ أضف كتبًا بقيمة {freeShippingThreshold} جنيه واستمتع بالشحن المجاني</p>
        <Link href="/books" className="btn btn-primary mt-4">تصفح الكتب</Link>
      </div>
    );
  }

  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const shippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);
  const wouldExceedCap = alreadyOrdered + totalItems > cap;
  const overCapBy = alreadyOrdered + totalItems - cap;
  const cartChanged = openingNotices.length > 0;
  const checkoutBlocked = wouldExceedCap || (cartChanged && !acknowledged);

  return (
    <div className="grid lg:grid-cols-[1fr_350px] gap-6 lg:gap-8 items-start">
      {/* Items */}
      <div className="space-y-3 sm:space-y-4">
        {cartChanged && !acknowledged && (
          <div className="card border border-accent/40 bg-accent/5 p-4">
            <h3 className="font-bold text-primary-dark mb-2">
              <i className="fa-solid fa-circle-info ml-1 text-accent-dark" />
              تم تحديث السلة
            </h3>
            <ul className="text-sm space-y-1 mb-3 text-ink/80">
              {openingNotices.map((n) => (
                <li key={n.book_id}>• {n.message}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setAcknowledged(true)}
              className="btn btn-primary text-sm py-2 px-5"
            >
              فهمت — متابعة
            </button>
          </div>
        )}

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
                    onClick={() => {
                      trackRemoveFromCart(item, item.quantity);
                      remove(item.book_id);
                    }}
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
                      onClick={() => increment(item.book_id, item.quantity)}
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

                {rowNotices[item.book_id] && (
                  <p
                    role="status"
                    className={`mt-2 text-[0.72rem] px-2 py-1 rounded-s ${
                      rowNotices[item.book_id].kind === 'adjust'
                        ? 'bg-accent/10 text-accent-dark border border-accent/30'
                        : 'bg-danger/10 text-danger border border-danger/30'
                    }`}
                  >
                    {rowNotices[item.book_id].message}
                  </p>
                )}
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

        {cartChanged && !acknowledged && (
          <div className="bg-accent/10 border border-accent/30 text-accent-dark text-sm p-3 rounded-s mb-4">
            راجع التحديثات أعلاه قبل المتابعة.
          </div>
        )}

        {isSignedIn ? (
          <Link
            href="/checkout"
            aria-disabled={checkoutBlocked}
            className={`btn btn-primary w-full py-3 text-base text-center ${checkoutBlocked ? 'opacity-50 pointer-events-none' : ''}`}
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
