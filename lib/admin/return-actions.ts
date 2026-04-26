'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireFullAdmin } from './auth';

export async function approveReturn(returnId: string, refundAmount: number) {
  await requireFullAdmin();
  const supa = await createClient();
  const { error } = await supa
    .from('returns')
    .update({ status: 'approved', refund_amount: refundAmount, resolved_at: new Date().toISOString() })
    .eq('id', returnId);
  if (error) return { error: error.message };
  revalidatePath('/admin/returns');
  return { ok: true };
}

export async function rejectReturn(returnId: string) {
  await requireFullAdmin();
  const supa = await createClient();
  const { error } = await supa
    .from('returns')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', returnId);
  if (error) return { error: error.message };
  revalidatePath('/admin/returns');
  return { ok: true };
}

export async function markReturnReceived(returnId: string) {
  await requireFullAdmin();
  const supa = await createClient();
  // Read the return to know which order/items are coming back
  const { data: ret } = await supa
    .from('returns')
    .select('order_id, items, refund_amount')
    .eq('id', returnId)
    .maybeSingle();
  if (!ret) return { error: 'الإرجاع غير موجود' };

  // Restore stock to the order's branch for each returned item
  const { data: order } = await supa.from('orders').select('branch_id').eq('id', ret.order_id).maybeSingle();
  if (order) {
    const items = (ret.items as any[]) ?? [];
    for (const it of items) {
      const { data: stock } = await supa
        .from('branch_stock')
        .select('quantity')
        .eq('branch_id', order.branch_id)
        .eq('book_id', it.book_id)
        .maybeSingle();
      if (stock) {
        await supa
          .from('branch_stock')
          .update({ quantity: stock.quantity + it.quantity })
          .eq('branch_id', order.branch_id)
          .eq('book_id', it.book_id);
      }
    }
  }

  await supa
    .from('returns')
    .update({ status: 'refunded', resolved_at: new Date().toISOString() })
    .eq('id', returnId);

  revalidatePath('/admin/returns');
  return { ok: true };
}
