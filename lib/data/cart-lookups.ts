/**
 * Server-side lookups called from the client cart context via server actions.
 * Lets the cart page verify per-branch availability for current items without
 * exposing branch stock tables to RLS fiddling.
 */
'use server';

import { createClient } from '@/lib/supabase/server';

export interface BranchAvailability {
  branch_id: string;
  branch_slug: string;
  branch_name_ar: string;
  can_fulfill: boolean;                 // true if branch has ≥ requested qty for EVERY book in cart
  missing: Array<{ book_id: number; title_ar: string; wanted: number; available: number }>;
}

export async function checkCartAvailability(
  items: Array<{ book_id: number; quantity: number }>
): Promise<BranchAvailability[]> {
  if (items.length === 0) return [];
  const supa = await createClient();

  const { data: branches } = await supa
    .from('branches')
    .select('id, slug, name_ar')
    .eq('is_active', true)
    .order('sort_order');

  const { data: stock } = await supa
    .from('branch_stock')
    .select('branch_id, book_id, quantity, reserved_quantity')
    .in('book_id', items.map((i) => i.book_id));

  const { data: books } = await supa
    .from('books')
    .select('id, title_ar')
    .in('id', items.map((i) => i.book_id));
  const titleMap = new Map((books ?? []).map((b) => [b.id, b.title_ar]));

  // Pre-index stock by `branch_id:book_id` so the nested branch×item lookup
  // is O(branches+items) instead of O(branches×items×stock). Cart can have
  // up to 10 books and we have 3 branches; not a huge win in absolute terms
  // but called every cart-page render and on every quantity change.
  const stockIndex = new Map<string, { quantity: number; reserved_quantity: number }>();
  for (const s of stock ?? []) {
    stockIndex.set(`${s.branch_id}:${s.book_id}`, {
      quantity: s.quantity,
      reserved_quantity: s.reserved_quantity,
    });
  }

  const result: BranchAvailability[] = [];
  for (const br of branches ?? []) {
    const missing: BranchAvailability['missing'] = [];
    for (const want of items) {
      const row = stockIndex.get(`${br.id}:${want.book_id}`);
      const available = row ? row.quantity - row.reserved_quantity : 0;
      if (available < want.quantity) {
        missing.push({
          book_id: want.book_id,
          title_ar: titleMap.get(want.book_id) ?? '(غير معروف)',
          wanted: want.quantity,
          available: Math.max(0, available),
        });
      }
    }
    result.push({
      branch_id: br.id,
      branch_slug: br.slug,
      branch_name_ar: br.name_ar,
      can_fulfill: missing.length === 0,
      missing,
    });
  }
  return result;
}
