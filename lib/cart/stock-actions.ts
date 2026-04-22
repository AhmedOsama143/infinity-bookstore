'use server';

import { createClient } from '@/lib/supabase/server';

export async function toggleBackInStockWatcher(bookId: number) {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { requires_login: true };

  const { error } = await supa
    .from('back_in_stock_watchers')
    .insert({ student_id: user.id, book_id: bookId, branch_id: null })
    .select();

  if (error && !error.message.includes('duplicate')) return { error: error.message };
  return { ok: true };
}
