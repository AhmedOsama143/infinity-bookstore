'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireFullAdmin } from './auth';

export async function moderateReview(reviewId: string, status: 'approved' | 'rejected') {
  await requireFullAdmin();
  const supa = await createClient();
  const { data, error } = await supa
    .from('reviews')
    .update({ status, resolved_at: new Date().toISOString() })
    .eq('id', reviewId)
    .select('book_id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/admin/reviews');
  if (data?.book_id) revalidatePath(`/books/${data.book_id}`);
  return { ok: true };
}
