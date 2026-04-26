'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from './cart-provider';
import type { CartItem } from '@/lib/cart/types';

interface Props {
  item: Omit<CartItem, 'quantity'>;
  disabled?: boolean;
  disabledReason?: string;
  full?: boolean;
  // When true, hide the secondary "view cart" link — keeps grid card heights uniform
  compact?: boolean;
}

export default function AddToCartButton({ item, disabled, disabledReason, full, compact }: Props) {
  const { add, items } = useCart();
  const [pulse, setPulse] = useState(false);
  const router = useRouter();
  const already = items.find((i) => i.book_id === item.book_id);

  function handle() {
    if (disabled) return;
    add({ ...item, quantity: 1 });
    setPulse(true);
    setTimeout(() => setPulse(false), 700);
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
    <div className={full ? 'flex flex-col gap-2' : 'flex gap-2'}>
      <button
        type="button"
        onClick={handle}
        className={`btn btn-primary ${sizeClass} transition-transform ${full ? 'w-full' : 'px-8'} ${pulse ? 'scale-105' : ''}`}
      >
        <i className={iconClass} />
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
  );
}
