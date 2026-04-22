'use client';
import Link from 'next/link';
import { useCart } from './cart-provider';

export default function CartBadge() {
  const { totalItems, isHydrated } = useCart();
  return (
    <Link
      href="/cart"
      className="text-ink hover:text-primary text-lg px-2 relative"
      aria-label="السلة"
    >
      <i className="fa-solid fa-cart-shopping" />
      {isHydrated && totalItems > 0 && (
        <span className="absolute -top-1 -left-1 bg-accent text-white text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center">
          {totalItems}
        </span>
      )}
    </Link>
  );
}
