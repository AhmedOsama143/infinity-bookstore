'use client';

import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import AddToCartButton from './add-to-cart-button';
import type { CartItem } from '@/lib/cart/types';

interface Props {
  item: Omit<CartItem, 'quantity'>;
  finalPrice: number;
  originalPrice?: number | null;
  // Element ID of the in-flow ATC region. While that element is on screen the
  // sticky bar stays hidden (would be visually redundant). Once the user
  // scrolls it out of view, the sticky bar slides up.
  sentinelId: string;
}

export default function StickyMobileAtc({ item, finalPrice, originalPrice, sentinelId }: Props) {
  const [isInFlowVisible, setIsInFlowVisible] = useState(true);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(sentinelId);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInFlowVisible(entry.isIntersecting),
      { threshold: 0.4 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [sentinelId]);

  // While the bar is on screen, lift the global WhatsApp FAB above it so the two
  // don't overlap on mobile. We publish the bar's measured height as a CSS var
  // and toggle a body class the FAB's stylesheet keys off of (see globals.css).
  const barVisible = !isInFlowVisible;
  useEffect(() => {
    const body = document.body;
    if (barVisible) {
      body.style.setProperty('--atc-bar-height', `${barRef.current?.offsetHeight ?? 64}px`);
      body.classList.add('atc-bar-up');
    } else {
      body.classList.remove('atc-bar-up');
    }
    return () => body.classList.remove('atc-bar-up');
  }, [barVisible]);

  const hasDiscount = originalPrice != null && originalPrice > finalPrice;

  return (
    <div
      ref={barRef}
      className={`md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-bg-light shadow-[0_-4px_16px_rgba(0,0,0,0.06)] transform transition-transform duration-200 ease-out ${
        isInFlowVisible ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-hidden={isInFlowVisible}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex flex-col items-start min-w-0">
          <span className="text-lg font-extrabold text-accent-dark leading-none whitespace-nowrap">
            {formatPrice(finalPrice)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-[#999] line-through leading-none mt-0.5">
              {formatPrice(originalPrice!)}
            </span>
          )}
        </div>
        <div className="flex-1">
          <AddToCartButton item={item} full touchpoint="pdp_sticky_mobile" />
        </div>
      </div>
    </div>
  );
}
