'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireFullAdmin } from './auth';

export async function createTransfer(formData: FormData) {
  const ctx = await requireFullAdmin();
  const supa = await createClient();
  const from_branch = String(formData.get('from_branch') ?? '');
  const to_branch = String(formData.get('to_branch') ?? '');
  const book_id = Number(formData.get('book_id'));
  const quantity = Number(formData.get('quantity'));
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!from_branch || !to_branch) return { error: 'حدد الفرعين' };
  if (from_branch === to_branch) return { error: 'الفرعان يجب أن يكونا مختلفين' };
  if (!Number.isFinite(book_id)) return { error: 'حدد الكتاب' };
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'الكمية غير صحيحة' };

  const { data: transfer, error } = await supa
    .from('stock_transfers')
    .insert({
      from_branch,
      to_branch,
      book_id,
      quantity,
      notes,
      created_by: ctx.userId,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  // Execute immediately for now (admin action). Can add separate "approve" step later.
  const { error: execErr } = await supa.rpc('execute_stock_transfer', { p_transfer_id: transfer.id });
  if (execErr) {
    await supa.from('stock_transfers').update({ status: 'cancelled' }).eq('id', transfer.id);
    return { error: execErr.message.includes('INSUFFICIENT_STOCK') ? 'الكمية غير متوفرة في الفرع المصدر' : execErr.message };
  }

  revalidatePath('/admin/transfers');
  revalidatePath('/admin/branches');
  return { ok: true };
}
