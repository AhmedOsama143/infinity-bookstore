'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireFullAdmin } from './auth';
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
  const supa = await createClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `book_${bookId}.${ext}`;
  const { error } = await supa.storage
    .from('book-covers')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supa.storage.from('book-covers').getPublicUrl(path).data.publicUrl;
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
  if (error) return { error: error.message };

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
  if (error) return { error: error.message };

  if (parsed.per_branch_stock.length > 0) {
    const rows = parsed.per_branch_stock.map((s) => ({ ...s, book_id: parsed.id! }));
    await supa.from('branch_stock').upsert(rows, { onConflict: 'branch_id,book_id' });
  }

  revalidatePath('/admin/books');
  revalidatePath(`/admin/books/${parsed.id}/edit`);
  revalidatePath(`/books/${parsed.id}`);
  return { book_id: parsed.id };
}

export async function deleteBook(bookId: number) {
  await requireFullAdmin();
  const supa = await createClient();
  const { error } = await supa.from('books').update({ is_active: false }).eq('id', bookId);
  if (error) return { error: error.message };
  revalidatePath('/admin/books');
  return { ok: true };
}
