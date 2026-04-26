'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function submitReview(formData: FormData) {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: 'يجب تسجيل الدخول' };

  const order_id = String(formData.get('order_id') ?? '');
  const book_id = Number(formData.get('book_id'));
  const rating = Number(formData.get('rating'));
  const title_ar = String(formData.get('title_ar') ?? '').trim() || null;
  const body_ar = String(formData.get('body_ar') ?? '').trim() || null;

  if (!order_id || !Number.isFinite(book_id)) return { error: 'بيانات غير صحيحة' };
  if (![1, 2, 3, 4, 5].includes(rating)) return { error: 'حدد التقييم من 1 إلى 5' };

  const { error } = await supa.from('reviews').insert({
    order_id,
    book_id,
    student_id: user.id,
    rating,
    title_ar,
    body_ar,
    status: 'pending',
  });
  if (error) {
    if (error.message.includes('duplicate')) return { error: 'لقد قمت بمراجعة هذا الكتاب من قبل' };
    return { error: error.message };
  }

  revalidatePath(`/books/${book_id}`);
  return { ok: true };
}
