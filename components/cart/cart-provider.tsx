'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { dropAllCartHolds, dropCartHold } from '@/lib/stock/integrity';
import type { CartItem } from '@/lib/cart/types';

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  add: (item: CartItem) => void;
  remove: (bookId: number) => void;
  setQuantity: (bookId: number, quantity: number) => void;
  /** Set the absolute quantity for a line, creating it if missing. */
  upsertQuantity: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  clear: () => void;
  isHydrated: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'infinity:cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setIsHydrated(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, isHydrated]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.book_id === item.book_id);
      if (existing) {
        return prev.map((p) =>
          p.book_id === item.book_id ? { ...p, quantity: p.quantity + item.quantity } : p
        );
      }
      return [...prev, item];
    });
  }, []);

  const remove = useCallback((bookId: number) => {
    setItems((prev) => prev.filter((p) => p.book_id !== bookId));
    // Fire-and-forget: drop the soft-hold so other shoppers regain availability.
    void dropCartHold(bookId).catch(() => {});
  }, []);

  const setQuantity = useCallback((bookId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((p) => p.book_id !== bookId));
      void dropCartHold(bookId).catch(() => {});
    } else {
      setItems((prev) =>
        prev.map((p) => (p.book_id === bookId ? { ...p, quantity } : p))
      );
    }
  }, []);

  const upsertQuantity = useCallback(
    (item: Omit<CartItem, 'quantity'>, quantity: number) => {
      if (quantity <= 0) {
        setItems((prev) => prev.filter((p) => p.book_id !== item.book_id));
        return;
      }
      setItems((prev) => {
        const existing = prev.find((p) => p.book_id === item.book_id);
        if (existing) {
          return prev.map((p) => (p.book_id === item.book_id ? { ...p, quantity } : p));
        }
        return [...prev, { ...item, quantity }];
      });
    },
    []
  );

  const clear = useCallback(() => {
    setItems([]);
    void dropAllCartHolds().catch(() => {});
  }, []);

  const { totalItems, subtotal } = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        totalItems: acc.totalItems + item.quantity,
        subtotal: acc.subtotal + item.quantity * item.unit_price,
      }),
      { totalItems: 0, subtotal: 0 }
    );
  }, [items]);

  const value: CartContextValue = {
    items,
    totalItems,
    subtotal,
    add,
    remove,
    setQuantity,
    upsertQuantity,
    clear,
    isHydrated,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
