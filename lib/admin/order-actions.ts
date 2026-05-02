'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from './auth';
import { sendEmail, orderStatusEmailHtml } from '@/lib/email';
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
  const { data: order } = await supa
    .from('orders')
    .select('status, order_number, total, branch:branches(name_ar), student:students(full_name, email)')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { error: 'الطلب غير موجود' };
  const current = order.status as OrderStatus;
  if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
    return { error: `لا يمكن تغيير الحالة من ${current} إلى ${next}` };
  }
  const update: any = { status: next };
  if (next === 'cancelled' && reason) update.cancel_reason = reason;
  const { error } = await supa.from('orders').update(update).eq('id', orderId);
  if (error) return { error: error.message };

  // Fire-and-forget email — never block the action on email delivery.
  const student = (order as any).student;
  if (student?.email) {
    const { subject, html } = orderStatusEmailHtml({
      orderNumber: (order as any).order_number,
      status: next,
      customerName: student.full_name ?? 'عميلنا العزيز',
      branchName: (order as any).branch?.name_ar ?? '',
      total: Number((order as any).total ?? 0),
      cancelReason: reason ?? null,
    });
    sendEmail({ to: student.email, subject, html }).catch(() => {});
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
