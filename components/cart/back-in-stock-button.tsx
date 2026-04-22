'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleBackInStockWatcher } from '@/lib/cart/stock-actions';

export default function BackInStockButton({ bookId }: { bookId: number }) {
  const [status, setStatus] = useState<'idle' | 'on' | 'err'>('idle');
  const [isPending, start] = useTransition();
  const router = useRouter();

  function handle() {
    start(async () => {
      const res = await toggleBackInStockWatcher(bookId);
      if (res?.requires_login) {
        router.push(`/login?next=/books/${bookId}`);
        return;
      }
      if (res?.error) setStatus('err');
      else setStatus('on');
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={isPending || status === 'on'}
      className="btn btn-outline px-8 py-3 text-base disabled:opacity-60"
    >
      <i className={`fa-${status === 'on' ? 'solid fa-bell-on' : 'regular fa-bell'} ml-2`} />
      {status === 'on'
        ? '✓ هنعلمك لما يتوفر'
        : isPending
          ? '...'
          : 'أعلمني عند التوفر'}
    </button>
  );
}
