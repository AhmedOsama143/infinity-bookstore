'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from './auth';
import type { OrderStatus } from '@/lib/types';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready:     ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export async function transitionOrder(orderId: string, next: OrderStatus, reason?: string) {
  await requireAdmin();
  const supa = await createClient();
  const { data: order } = await supa.from('orders').select('status').eq('id', orderId).maybeSingle();
  if (!order) return { error: 'الطلب غير موجود' };
  const current = order.status as OrderStatus;
  if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
    return { error: `لا يمكن تغيير الحالة من ${current} إلى ${next}` };
  }
  const update: any = { status: next };
  if (next === 'cancelled' && reason) update.cancel_reason = reason;
  const { error } = await supa.from('orders').update(update).eq('id', orderId);
  if (error) return { error: error.message };

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
