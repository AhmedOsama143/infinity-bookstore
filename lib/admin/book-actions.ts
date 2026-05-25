'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireFullAdmin } from './auth';
import { translateDbError } from './errors';
import type { GradeLevel, BookType } from '@/lib/types';

export interface BookActionResult {
  error?: string;
  book_id?: number;
}

interface BookPayload {
  id?: number;
  title_ar: string;
  teacher_id: number | null;
  grade_level: GradeLevel;
  book_type: BookType;
  description: string | null;
  price: number;
  discount_pct: number;
  weight_grams: number | null;
  publish_year: number | null;
  isbn: string | null;
  is_active: boolean;
  cover_url?: string | null;
  per_branch_stock: { branch_id: string; quantity: number }[];
}

function parsePayload(formData: FormData, includeId = false): BookPayload | string {
  const title_ar = String(formData.get('title_ar') ?? '').trim();
  if (!title_ar) return 'عنوان الكتاب مطلوب';

  const price = Number(formData.get('price') ?? 0);
  if (!Number.isFinite(price) || price < 0) return 'السعر غير صحيح';

  const discount_pct = Number(formData.get('discount_pct') ?? 0);
  if (!Number.isFinite(discount_pct) || discount_pct < 0 || discount_pct > 100) return 'نسبة الخصم غير صحيحة';

  const teacherRaw = formData.get('teacher_id');
  const teacher_id = teacherRaw ? Number(teacherRaw) : null;

  // Per-branch stock — fields named stock_<branch_id>
  const per_branch_stock: { branch_id: string; quantity: number }[] = [];
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('stock_')) {
      const branch_id = k.slice('stock_'.length);
      const qty = Math.max(0, Math.floor(Number(v)));
      if (Number.isFinite(qty)) per_branch_stock.push({ branch_id, quantity: qty });
    }
  }

  const payload: BookPayload = {
    title_ar,
    teacher_id: Number.isFinite(teacher_id ?? NaN) ? teacher_id : null,
    grade_level: (formData.get('grade_level') ?? 'third_secondary') as GradeLevel,
    book_type: (formData.get('book_type') ?? 'external_ar') as BookType,
    description: String(formData.get('description') ?? '').trim() || null,
    price,
    discount_pct,
    weight_grams: formData.get('weight_grams') ? Number(formData.get('weight_grams')) : null,
    publish_year: formData.get('publish_year') ? Number(formData.get('publish_year')) : null,
    isbn: String(formData.get('isbn') ?? '').trim() || null,
    is_active: formData.get('is_active') === 'on',
    per_branch_stock,
  };
  if (includeId) {
    const id = Number(formData.get('id'));
    if (!Number.isFinite(id)) return 'معرف الكتاب مفقود';
    payload.id = id;
  }
  return payload;
}

async function uploadCoverIfPresent(formData: FormData, bookId: number): Promise<string | null> {
  const file = formData.get('cover');
  if (!(file instanceof File) || file.size === 0) return null;
  // Storage bucket has no INSERT policy for the anon-cookie session; use the
  // service-role client. Safe: caller already gated by requireFullAdmin().
  const supa = createAdminClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `book_${bookId}.${ext}`;
  const { error } = await supa.storage
    .from('book-covers')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return `${supa.storage.from('book-covers').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}

export async function createBook(formData: FormData): Promise<BookActionResult> {
  await requireFullAdmin();
  const parsed = parsePayload(formData);
  if (typeof parsed === 'string') return { error: parsed };

  const supa = await createClient();
  // Compute next id (since DB doesn't auto-generate — we used INTEGER from books.md)
  const { data: maxRow } = await supa.from('books').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
  const nextId = (maxRow?.id ?? 0) + 1;

  let cover_url: string | null = null;
  try {
    cover_url = await uploadCoverIfPresent(formData, nextId);
  } catch (e: any) {
    return { error: 'فشل رفع الصورة: ' + e.message };
  }

  const { error } = await supa.from('books').insert({
    id: nextId,
    title_ar: parsed.title_ar,
    teacher_id: parsed.teacher_id,
    grade_level: parsed.grade_level,
    book_type: parsed.book_type,
    description: parsed.description,
    price: parsed.price,
    discount_pct: parsed.discount_pct,
    weight_grams: parsed.weight_grams,
    publish_year: parsed.publish_year,
    isbn: parsed.isbn,
    is_active: parsed.is_active,
    cover_url,
    needs_review: false,
  });
  if (error) return { error: translateDbError(error, 'admin/books', 'create_failed') };

  if (parsed.per_branch_stock.length > 0) {
    const rows = parsed.per_branch_stock.map((s) => ({ ...s, book_id: nextId }));
    await supa.from('branch_stock').upsert(rows, { onConflict: 'branch_id,book_id' });
  }

  revalidatePath('/admin/books');
  redirect(`/admin/books/${nextId}/edit`);
}

export async function updateBook(formData: FormData): Promise<BookActionResult> {
  await requireFullAdmin();
  const parsed = parsePayload(formData, true);
  if (typeof parsed === 'string') return { error: parsed };
  if (!parsed.id) return { error: 'معرف غير موجود' };

  const supa = await createClient();
  let cover_url: string | null = null;
  try {
    cover_url = await uploadCoverIfPresent(formData, parsed.id);
  } catch (e: any) {
    return { error: 'فشل رفع الصورة: ' + e.message };
  }

  const update: any = {
    title_ar: parsed.title_ar,
    teacher_id: parsed.teacher_id,
    grade_level: parsed.grade_level,
    book_type: parsed.book_type,
    description: parsed.description,
    price: parsed.price,
    discount_pct: parsed.discount_pct,
    weight_grams: parsed.weight_grams,
    publish_year: parsed.publish_year,
    isbn: parsed.isbn,
    is_active: parsed.is_active,
    needs_review: false,
  };
  if (cover_url) update.cover_url = cover_url;

  const { error } = await supa.from('books').update(update).eq('id', parsed.id);
  if (error) return { error: translateDbError(error, 'admin/books', 'update_failed', { id: parsed.id }) };

  if (parsed.per_branch_stock.length > 0) {
    const rows = parsed.per_branch_stock.map((s) => ({ ...s, book_id: parsed.id! }));
    await supa.from('branch_stock').upsert(rows, { onConflict: 'branch_id,book_id' });
  }

  revalidatePath('/admin/books');
  revalidatePath(`/admin/books/${parsed.id}/edit`);
  revalidatePath(`/books/${parsed.id}`);
  redirect('/admin/books');
}

export async function deleteBook(bookId: number) {
  await requireFullAdmin();
  const supa = await createClient();
  const { error } = await supa.from('books').update({ is_active: false }).eq('id', bookId);
  if (error) return { error: translateDbError(error, 'admin/books', 'delete_failed', { bookId }) };
  revalidatePath('/admin/books');
  return { ok: true };
}

export interface BulkImportResult {
  ok?: { created: number; updated: number };
  error?: string;
  errors?: { row: number; message: string }[];
}

// CSV columns (header row required, comma-separated):
// title_ar,teacher_id,grade_level,book_type,price,discount_pct,
// weight_grams,publish_year,isbn,description,
// stock_<branch_slug>... (one column per branch)
//
// grade_level: first_secondary | second_secondary | third_secondary
// book_type:   external_ar | online_ar
export async function bulkImportBooksCsv(formData: FormData): Promise<BulkImportResult> {
  await requireFullAdmin();
  const file = formData.get('csv');
  if (!(file instanceof File) || file.size === 0) return { error: 'يرجى اختيار ملف CSV' };

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: 'الملف فارغ أو يفتقد العناوين' };

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const required = ['title_ar', 'grade_level', 'book_type', 'price'];
  for (const r of required) {
    if (!headers.includes(r)) return { error: `العمود "${r}" مفقود في الـ CSV` };
  }

  const supa = await createClient();
  const { data: branches } = await supa.from('branches').select('id, slug').eq('is_active', true);
  const slugToId = new Map((branches ?? []).map((b: any) => [b.slug, b.id as string]));

  const validGrades = new Set(['first_secondary', 'second_secondary', 'third_secondary']);
  const validTypes = new Set(['external_ar', 'online_ar']);
  const errors: { row: number; message: string }[] = [];
  let created = 0;
  let updated = 0;

  // Compute starting id for new inserts
  const { data: maxRow } = await supa.from('books').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
  let nextId = (maxRow?.id ?? 0) + 1;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && !row[0].trim()) continue; // blank line
    const get = (col: string) => row[headers.indexOf(col)]?.trim() ?? '';

    const title_ar = get('title_ar');
    if (!title_ar) {
      errors.push({ row: i + 1, message: 'العنوان مطلوب' });
      continue;
    }
    const grade_level = get('grade_level') as GradeLevel;
    if (!validGrades.has(grade_level)) {
      errors.push({ row: i + 1, message: `صف غير صحيح: ${grade_level}` });
      continue;
    }
    const book_type = get('book_type') as BookType;
    if (!validTypes.has(book_type)) {
      errors.push({ row: i + 1, message: `نوع غير صحيح: ${book_type}` });
      continue;
    }
    const price = Number(get('price'));
    if (!Number.isFinite(price) || price < 0) {
      errors.push({ row: i + 1, message: `سعر غير صحيح: ${get('price')}` });
      continue;
    }

    const teacher_id = get('teacher_id') ? Number(get('teacher_id')) : null;
    const discount_pct = get('discount_pct') ? Number(get('discount_pct')) : 0;
    const weight_grams = get('weight_grams') ? Number(get('weight_grams')) : null;
    const publish_year = get('publish_year') ? Number(get('publish_year')) : null;
    const isbn = get('isbn') || null;
    const description = get('description') || null;

    // Match existing book by title to allow update on re-import.
    const { data: existing } = await supa
      .from('books')
      .select('id')
      .eq('title_ar', title_ar)
      .maybeSingle();

    let bookId: number;
    const fields = {
      title_ar,
      teacher_id,
      grade_level,
      book_type,
      description,
      price,
      discount_pct,
      weight_grams,
      publish_year,
      isbn,
      is_active: true,
      needs_review: false,
    };

    if (existing) {
      bookId = existing.id;
      const { error } = await supa.from('books').update(fields).eq('id', bookId);
      if (error) {
        errors.push({ row: i + 1, message: error.message });
        continue;
      }
      updated++;
    } else {
      bookId = nextId++;
      const { error } = await supa.from('books').insert({ id: bookId, ...fields });
      if (error) {
        errors.push({ row: i + 1, message: error.message });
        continue;
      }
      created++;
    }

    // Per-branch stock columns
    const stockRows: { branch_id: string; book_id: number; quantity: number }[] = [];
    for (const h of headers) {
      if (!h.startsWith('stock_')) continue;
      const slug = h.slice('stock_'.length);
      const branch_id = slugToId.get(slug);
      if (!branch_id) continue;
      const qty = Math.max(0, Math.floor(Number(get(h) || 0)));
      if (Number.isFinite(qty)) stockRows.push({ branch_id, book_id: bookId, quantity: qty });
    }
    if (stockRows.length > 0) {
      await supa.from('branch_stock').upsert(stockRows, { onConflict: 'branch_id,book_id' });
    }
  }

  revalidatePath('/admin/books');
  return { ok: { created, updated }, errors: errors.length ? errors : undefined };
}

// Minimal CSV parser supporting quoted fields with embedded commas/newlines.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let inQuotes = false;
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(cell); cell = ''; }
      else if (c === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; }
      else if (c === '\r') { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur); }
  return rows;
}
