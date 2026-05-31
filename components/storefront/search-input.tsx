'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

interface Props {
  initialValue?: string;
  autoFocus?: boolean;
}

export default function SearchInput({ initialValue = '', autoFocus = false }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const lastPushed = useRef(initialValue);

  useEffect(() => {
    const next = value.trim();
    if (next === lastPushed.current) return;
    const t = setTimeout(() => {
      lastPushed.current = next;
      startTransition(() => {
        router.replace(next ? `/search?q=${encodeURIComponent(next)}` : '/search');
      });
    }, 250);
    return () => clearTimeout(t);
  }, [value, router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (next === lastPushed.current) return;
    lastPushed.current = next;
    startTransition(() => {
      router.replace(next ? `/search?q=${encodeURIComponent(next)}` : '/search');
    });
  }

  return (
    <form onSubmit={onSubmit} className={isPending ? 'opacity-80' : ''}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            name="q"
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="ابحث عن كتاب أو مدرس"
            placeholder="ابحث عن كتاب أو مدرس..."
            autoFocus={autoFocus}
            className="w-full px-4 py-3 pl-10 rounded-pill border border-[#ddd] focus:outline-none focus:border-primary font-body"
          />
          {isPending && (
            <i
              aria-hidden
              className="fa-solid fa-circle-notch fa-spin absolute left-4 top-1/2 -translate-y-1/2 text-primary"
            />
          )}
        </div>
        <button type="submit" className="btn btn-primary px-8">
          بحث
        </button>
      </div>
    </form>
  );
}
