/**
 * Server-side data fetchers. Import from server components / server actions only.
 */
import { createClient } from '@/lib/supabase/server';
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

// ---------- Branches ----------
export async function getBranches(): Promise<Branch[]> {
  const supa = await createClient();
  const { data } = await supa
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  return (data ?? []) as Branch[];
}

// ---------- Site settings + content ----------
export async function getSiteSettings(): Promise<SiteSettings | null> {
  const supa = await createClient();
  const { data } = await supa.from('site_settings').select('*').single();
  return data as SiteSettings | null;
}

export async function getSiteContent(key: string): Promise<SiteContent | null> {
  const supa = await createClient();
  const { data } = await supa.from('site_content').select('*').eq('key', key).maybeSingle();
  return data as SiteContent | null;
}

// ---------- Teachers ----------
export async function getTeachers(): Promise<Teacher[]> {
  const supa = await createClient();
  const { data } = await supa
    .from('teachers')
    .select('*')
    .eq('is_active', true)
    .order('name_ar');
  return (data ?? []) as Teacher[];
}

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
export interface BookListFilters {
  grade?: GradeLevel;
  teacher_id?: number;
  search?: string;
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
  query = query.order('id', { ascending: false });

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

// Batch helper: availability summary per book for list pages
export async function getAvailabilitySummary(
  bookIds: number[]
): Promise<Map<number, { in_stock_branches: number; total_available: number }>> {
  if (bookIds.length === 0) return new Map();
  const supa = await createClient();
  const { data } = await supa
    .from('branch_stock')
    .select('book_id, quantity, reserved_quantity')
    .in('book_id', bookIds);
  const map = new Map<number, { in_stock_branches: number; total_available: number }>();
  for (const id of bookIds) map.set(id, { in_stock_branches: 0, total_available: 0 });
  for (const r of data ?? []) {
    const avail = (r.quantity as number) - (r.reserved_quantity as number);
    if (avail > 0) {
      const current = map.get(r.book_id as number)!;
      current.in_stock_branches += 1;
      current.total_available += avail;
    }
  }
  return map;
}
