'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from './cart-provider';
import { validateStock } from '@/lib/stock/integrity';
import BackInStockButton from './back-in-stock-button';
import type { CartItem } from '@/lib/cart/types';

interface Props {
  item: Omit<CartItem, 'quantity'>;
  disabled?: boolean;
  disabledReason?: string;
  full?: boolean;
  // When true, hide the secondary "view cart" link — keeps grid card heights uniform
  compact?: boolean;
  /** Where this button lives — recorded in the stock_decisions audit row. */
  touchpoint?: string;
}

type Feedback = {
  kind: 'block' | 'adjust';
  message: string;
  /** Set when the block is due to live stock running out — surfaces the notify-me CTA. */
  outOfStock?: boolean;
} | null;

export default function AddToCartButton({
  item,
  disabled,
  disabledReason,
  full,
  compact,
  touchpoint = 'product_button',
}: Props) {
  const { upsertQuantity, items } = useCart();
  const [pulse, setPulse] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const already = items.find((i) => i.book_id === item.book_id);
  const currentInCart = already?.quantity ?? 0;

  function handle() {
    if (disabled || isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await validateStock({
        actor_type: 'customer',
        action: 'add',
        book_id: item.book_id,
        requested_qty: 1,
        current_in_cart: currentInCart,
        touchpoint,
      });

      if (result.decision === 'allow') {
        upsertQuantity(item, result.final_qty);
        setPulse(true);
        setTimeout(() => setPulse(false), 700);
        return;
      }
      if (result.decision === 'adjust') {
        upsertQuantity(item, result.final_qty);
        setFeedback({ kind: 'adjust', message: result.user_message ?? 'تم تعديل الكمية حسب المتاح.' });
        setTimeout(() => setFeedback(null), 6000);
        return;
      }
      // block — keep the notify-me CTA persistent until the user dismisses it
      // by interacting with the page; auto-clearing felt unhelpful for a hard
      // block where we want them to opt in to back-in-stock alerts.
      const isOutOfStock =
        result.internal_flags.includes('out_of_stock') ||
        result.internal_flags.includes('at_limit');
      setFeedback({
        kind: 'block',
        message: result.user_message ?? 'هذا الكتاب غير متاح حاليًا.',
        outOfStock: isOutOfStock,
      });
      if (!isOutOfStock) setTimeout(() => setFeedback(null), 6000);
    });
  }

  const sizeClass = compact ? 'text-[0.78rem] py-2 !px-2 leading-tight whitespace-nowrap' : 'text-base py-3';
  const iconClass = compact ? 'fa-solid fa-cart-plus ml-1' : 'fa-solid fa-cart-plus ml-2';

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className={`btn btn-primary ${sizeClass} opacity-50 cursor-not-allowed ${full ? 'w-full' : 'px-8'}`}
      >
        <i className={compact ? 'fa-solid fa-ban ml-1' : 'fa-solid fa-ban ml-2'} />
        {disabledReason ?? 'غير متاح'}
      </button>
    );
  }

  return (
    <div className={full ? 'flex flex-col gap-2' : 'flex flex-col gap-2'}>
      <div className={full ? 'flex flex-col gap-2' : 'flex gap-2'}>
        <button
          type="button"
          onClick={handle}
          disabled={isPending}
          aria-busy={isPending}
          className={`btn btn-primary ${sizeClass} transition-transform ${full ? 'w-full' : 'px-8'} ${pulse ? 'scale-105' : ''} ${isPending ? 'opacity-70 cursor-wait' : ''}`}
        >
          <i className={isPending ? (compact ? 'fa-solid fa-spinner fa-spin ml-1' : 'fa-solid fa-spinner fa-spin ml-2') : iconClass} />
          {already ? `في السلة (${already.quantity})` : 'أضف للسلة'}
        </button>
        {already && !compact && (
          <button
            type="button"
            onClick={() => router.push('/cart')}
            className={`btn btn-outline text-sm py-2 ${full ? 'w-full' : ''}`}
          >
            عرض السلة
          </button>
        )}
      </div>
      {feedback && (
        <div
          role="status"
          className={`text-[0.72rem] leading-snug px-2 py-1.5 rounded-s ${
            feedback.kind === 'adjust'
              ? 'bg-accent/10 text-accent-dark border border-accent/30'
              : 'bg-danger/10 text-danger border border-danger/30'
          }`}
        >
          <p>{feedback.message}</p>
          {feedback.outOfStock && (
            <div className="mt-2">
              <BackInStockButton bookId={item.book_id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
