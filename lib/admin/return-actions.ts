'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireFullAdmin } from './auth';
import { translateDbError } from './errors';

export async function approveReturn(returnId: string, refundAmount: number) {
  await requireFullAdmin();
  const supa = await createClient();
  const { error } = await supa
    .from('returns')
    .update({ status: 'approved', refund_amount: refundAmount, resolved_at: new Date().toISOString() })
    .eq('id', returnId);
  if (error) return { error: translateDbError(error, 'admin/returns', 'approve_failed', { returnId }) };
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
  if (error) return { error: translateDbError(error, 'admin/returns', 'reject_failed', { returnId }) };
  revalidatePath('/admin/returns');
  return { ok: true };
}

export async function markReturnReceived(returnId: string) {
  await requireFullAdmin();
  const supa = await createClient();

  // Migration 022 puts the read-modify-write into a single Postgres function
  // so two concurrent staff clicks can't double-restore (TOCTOU) and a second
  // click on an already-refunded return is a no-op.
  const { data, error } = await supa.rpc('mark_return_received_atomic', {
    p_return_id: returnId,
  });
  if (error) {
    return { error: translateDbError(error, 'admin/returns', 'receive_failed', { returnId }) };
  }

  // RPC returns jsonb {ok, error?, already?}
  const result = data as { ok?: boolean; error?: string; already?: boolean } | null;
  if (!result?.ok) {
    if (result?.error === 'not_found') return { error: 'الإرجاع غير موجود' };
    if (result?.error === 'order_not_found') return { error: 'الطلب الأصلي غير موجود' };
    return { error: 'فشل تأكيد الاستلام' };
  }

  revalidatePath('/admin/returns');
  return { ok: true, alreadyRefunded: result.already === true };
}
