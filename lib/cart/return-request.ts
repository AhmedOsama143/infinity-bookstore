'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function requestReturn(formData: FormData) {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: 'يجب تسجيل الدخول' };

  const orderId = String(formData.get('order_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!orderId || !reason) return { error: 'يرجى إدخال السبب' };

  // Verify order belongs to student and is completed/ready
  const { data: order } = await supa
    .from('orders')
    .select('id, student_id, status, items:order_items(book_id, quantity, unit_price, book:books(title_ar))')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.student_id !== user.id) return { error: 'الطلب غير موجود' };
  if (!['completed', 'ready'].includes(order.status)) return { error: 'لا يمكن إرجاع هذا الطلب في حالته الحالية' };

  const items = ((order as any).items ?? []).map((it: any) => ({
    book_id: it.book_id,
    quantity: it.quantity,
    unit_price: Number(it.unit_price),
    title_ar: it.book?.title_ar,
  }));

  const { error } = await supa.from('returns').insert({
    order_id: orderId,
    items,
    reason,
    status: 'requested',
  });
  if (error) return { error: error.message };

  revalidatePath(`/account/orders`);
  return { ok: true };
}
