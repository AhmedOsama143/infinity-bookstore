/**
 * Server-side data fetchers. Import from server components / server actions only.
 */
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { log } from '@/lib/log';
import type {
  Book,
  BookWithTeacher,
  Branch,
  SiteContent,
  SiteSettings,
  Teacher,
  BranchStock,
  GradeLevel,
} from '@/lib/types';

// React.cache() dedupes calls within a single request. Storefront layout +
// footer + WhatsApp FAB + page each call getSiteSettings; without dedup that's
// 4 DB round-trips per render. Survives only the current request — real
// cross-request caching would require unstable_cache + a service-role client
// + the auth-gated layout restructure (deferred to a future phase).

// ---------- Branches ----------
export const getBranches = cache(async (): Promise<Branch[]> => {
  const supa = await createClient();
  const { data } = await supa
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  return (data ?? []) as Branch[];
});

// ---------- Site settings + content ----------
export const getSiteSettings = cache(async (): Promise<SiteSettings | null> => {
  const supa = await createClient();
  const { data } = await supa.from('site_settings').select('*').single();
  return data as SiteSettings | null;
});

export const getSiteContent = cache(async (key: string): Promise<SiteContent | null> => {
  const supa = await createClient();
  const { data } = await supa.from('site_content').select('*').eq('key', key).maybeSingle();
  return data as SiteContent | null;
});

// ---------- Teachers ----------
export const getTeachers = cache(async (): Promise<Teacher[]> => {
  const supa = await createClient();
  const { data } = await supa
    .from('teachers')
    .select('*')
    .eq('is_active', true)
    .order('name_ar');
  return (data ?? []) as Teacher[];
});

export async function getTeacher(id: number): Promise<Teacher | null> {
  const supa = await createClient();
  const { data } = await supa.from('teachers').select('*').eq('id', id).maybeSingle();
  return data as Teacher | null;
}

export async function getTeacherBooks(teacherId: number): Promise<Book[]> {
  const supa = await createClient();
  const { data } = await supa
    .from('books')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('is_active', true)
    .order('grade_level');
  return (data ?? []) as Book[];
}

// ---------- Books ----------
export type BookSort = 'newest' | 'price_low' | 'price_high';

export interface BookListFilters {
  grade?: GradeLevel;
  teacher_id?: number;
  search?: string;
  sort?: BookSort;
  limit?: number;
}

export async function getBooks(filters: BookListFilters = {}): Promise<BookWithTeacher[]> {
  const supa = await createClient();
  let query = supa
    .from('books')
    .select(
      'id, title_ar, teacher_id, grade_level, book_type, description, cover_url, price, discount_pct, final_price, weight_grams, publish_year, isbn, is_active, needs_review, teacher:teachers(id, name_ar, photo_url)'
    )
    .eq('is_active', true);

  if (filters.grade) query = query.eq('grade_level', filters.grade);
  if (filters.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
  if (filters.search) query = query.ilike('title_ar', `%${filters.search}%`);
  if (filters.limit) query = query.limit(filters.limit);

  switch (filters.sort) {
    case 'price_low':
      query = query.order('final_price', { ascending: true });
      break;
    case 'price_high':
      query = query.order('final_price', { ascending: false });
      break;
    default:
      query = query.order('id', { ascending: false });
  }

  const { data } = await query;
  return (data ?? []) as unknown as BookWithTeacher[];
}

export async function getBook(id: number): Promise<BookWithTeacher | null> {
  const supa = await createClient();
  const { data } = await supa
    .from('books')
    .select(
      'id, title_ar, teacher_id, grade_level, book_type, description, cover_url, price, discount_pct, final_price, weight_grams, publish_year, isbn, is_active, needs_review, teacher:teachers(id, name_ar, photo_url)'
    )
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();
  return data as unknown as BookWithTeacher | null;
}

// Trigram-based fuzzy search (Arabic-aware via pg_trgm).
export async function searchBooks(q: string, limit = 24): Promise<BookWithTeacher[]> {
  if (!q.trim()) return [];
  const supa = await createClient();
  const { data: matches, error } = await supa.rpc('search_books', { q, lim: limit });
  if (error) {
    // A failed RPC (e.g. migration 023 not yet applied) otherwise looks exactly
    // like "no results" to the user — surface it so ops can tell them apart.
    log.error('search', 'books_rpc_failed', { q, message: error.message });
    return [];
  }
  if (!matches || matches.length === 0) return [];
  const ids = matches.map((b: { id: number }) => b.id);
  const { data } = await supa
    .from('books')
    .select(
      'id, title_ar, teacher_id, grade_level, book_type, description, cover_url, price, discount_pct, final_price, weight_grams, publish_year, isbn, is_active, needs_review, teacher:teachers(id, name_ar, photo_url)'
    )
    .in('id', ids);
  // Preserve RPC ordering (best match first).
  const order = new Map<number, number>(
    (ids as number[]).map((id, i) => [id, i])
  );
  return ((data ?? []) as unknown as BookWithTeacher[]).sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );
}

export async function searchTeachers(q: string, limit = 12): Promise<Teacher[]> {
  if (!q.trim()) return [];
  const supa = await createClient();
  const { data, error } = await supa.rpc('search_teachers', { q, lim: limit });
  if (error) {
    log.error('search', 'teachers_rpc_failed', { q, message: error.message });
    return [];
  }
  return (data ?? []) as Teacher[];
}

export async function getRelatedBooks(
  book: Pick<BookWithTeacher, 'id' | 'teacher_id' | 'grade_level'>,
  limit = 6
): Promise<BookWithTeacher[]> {
  const supa = await createClient();
  let query = supa
    .from('books')
    .select(
      'id, title_ar, teacher_id, grade_level, book_type, cover_url, price, final_price, teacher:teachers(id, name_ar, photo_url)'
    )
    .eq('is_active', true)
    .neq('id', book.id)
    .limit(limit);

  // Prefer same teacher; fall back to same grade
  if (book.teacher_id) {
    query = query.or(`teacher_id.eq.${book.teacher_id},grade_level.eq.${book.grade_level}`);
  } else {
    query = query.eq('grade_level', book.grade_level);
  }

  const { data } = await query;
  return (data ?? []) as unknown as BookWithTeacher[];
}

// ---------- Stock / availability ----------
export interface BookStockByBranch {
  branch_id: string;
  branch_name_ar: string;
  branch_slug: string;
  branch_whatsapp: string;
  quantity: number;
  available: number; // quantity - reserved_quantity
}

export async function getBookStock(bookId: number): Promise<BookStockByBranch[]> {
  const supa = await createClient();
  const { data } = await supa
    .from('branch_stock')
    .select(
      'quantity, reserved_quantity, branch:branches(id, slug, name_ar, whatsapp, is_active, sort_order)'
    )
    .eq('book_id', bookId);
  const rows =
    (data ?? []).map((r: any) => ({
      branch_id: r.branch.id,
      branch_slug: r.branch.slug,
      branch_name_ar: r.branch.name_ar,
      branch_whatsapp: r.branch.whatsapp,
      quantity: r.quantity as number,
      available: (r.quantity as number) - (r.reserved_quantity as number),
      is_active: r.branch.is_active as boolean,
      sort_order: r.branch.sort_order as number,
    })) ?? [];
  return rows
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ is_active, sort_order, ...rest }) => rest);
}

export interface AvailabilitySummary {
  in_stock_branches: number;
  total_available: number;
  // Lowest non-zero per-branch availability and the branch name that holds
  // it. Used to render urgency badges like «آخر ٢ في فرع التمليك» on cards
  // when min_qty <= 3.
  min_qty: number | null;
  min_qty_branch_name: string | null;
}

// Batch helper: availability summary per book for list pages.
export async function getAvailabilitySummary(
  bookIds: number[]
): Promise<Map<number, AvailabilitySummary>> {
  const map = new Map<number, AvailabilitySummary>();
  if (bookIds.length === 0) return map;
  const supa = await createClient();
  const { data } = await supa
    .from('branch_stock')
    .select('book_id, quantity, reserved_quantity, branch:branches(name_ar)')
    .in('book_id', bookIds);
  for (const id of bookIds) {
    map.set(id, {
      in_stock_branches: 0,
      total_available: 0,
      min_qty: null,
      min_qty_branch_name: null,
    });
  }
  for (const r of data ?? []) {
    const avail = (r.quantity as number) - (r.reserved_quantity as number);
    if (avail <= 0) continue;
    const current = map.get(r.book_id as number)!;
    current.in_stock_branches += 1;
    current.total_available += avail;
    if (current.min_qty == null || avail < current.min_qty) {
      current.min_qty = avail;
      // Supabase typegen treats nested FK selects as arrays; runtime is a single
      // object for to-one relations.
      const branch = Array.isArray((r as any).branch) ? (r as any).branch[0] : (r as any).branch;
      current.min_qty_branch_name = branch?.name_ar ?? null;
    }
  }
  return map;
}
