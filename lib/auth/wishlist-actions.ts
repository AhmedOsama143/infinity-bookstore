'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addToWishlist(bookId: number) {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: 'يجب تسجيل الدخول' };
  const { error } = await supa
    .from('wishlists')
    .insert({ student_id: user.id, book_id: bookId });
  if (error && !error.message.includes('duplicate')) return { error: error.message };
  revalidatePath('/wishlist');
  return { ok: true };
}

export async function removeFromWishlist(bookId: number) {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: 'يجب تسجيل الدخول' };
  const { error } = await supa
    .from('wishlists')
    .delete()
    .eq('student_id', user.id)
    .eq('book_id', bookId);
  if (error) return { error: error.message };
  revalidatePath('/wishlist');
  return { ok: true };
}
