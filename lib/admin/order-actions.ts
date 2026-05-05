'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from './auth';
import { sendEmail, orderStatusEmailHtml } from '@/lib/email';
import { validateStock } from '@/lib/stock/integrity';
import type { GradeLevel, OrderStatus, PaymentMethod, PaymentStatus, PaymentType } from '@/lib/types';

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

export async function setOrderPaymentStatus(orderId: string, next: PaymentStatus) {
  const ctx = await requireAdmin();
  const supa = await createClient();

  const { data: order } = await supa
    .from('orders')
    .select('payment_status, payment_type, branch_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { error: 'الطلب غير موجود' };

  if (ctx.role === 'branch_manager' && order.branch_id !== ctx.branchId) {
    return { error: 'لا يمكنك تعديل طلب لفرع آخر' };
  }

  if (order.payment_type !== 'offline') {
    return { error: 'لا يمكن تعديل حالة الدفع للطلبات الإلكترونية يدوياً' };
  }

  const { error } = await supa
    .from('orders')
    .update({ payment_status: next })
    .eq('id', orderId);
  if (error) return { error: error.message };

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

// ============================================================================
// Manual order creation — staff entering an order from the dashboard.
// ============================================================================

export interface ManualOrderItemInput {
  book_id: number;
  quantity: number;
}

export interface ManualOrderInput {
  // Customer details — server dedups by phone (matching phone reuses the
  // existing student row, no match creates a guest with is_guest=true).
  customer_full_name: string;
  customer_phone: string;
  customer_grade_level?: GradeLevel | null;

  branch_id: string;
  items: ManualOrderItemInput[];

  // Required tags. payment_type is never auto-assumed — caller must choose.
  payment_type: PaymentType;
  payment_method: PaymentMethod;

  // Counter sale → status=completed, payment_status=paid (immediate stock decrement).
  // Phone order   → status=pending,   payment_status=pending (stock reserved, settled later).
  sale_type: 'completed_at_counter' | 'pending_phone_order';

  notes?: string | null;

  // Staff oversell flow: when validateStock returns warn_and_allow for any
  // item, the form must round-trip with oversell_confirmed=true before the
  // order is actually written. The optional staff_note is attached to the
  // stock_decisions audit row for procurement / reconciliation.
  oversell_confirmed?: boolean;
  staff_note?: string | null;
}

export interface OversellLine {
  book_id: number;
  title_ar: string | null;
  requested_qty: number;
  available_stock: number;
  overage: number;
  message: string;
}

export interface ManualOrderResult {
  error?: string;
  order_id?: string;
  order_number?: string;
  reused_existing_customer?: boolean;
  /** Set when staff must confirm an overage before the order is created. */
  requires_oversell_confirmation?: boolean;
  oversells?: OversellLine[];
}

export async function createManualOrder(input: ManualOrderInput): Promise<ManualOrderResult> {
  const ctx = await requireAdmin();

  // Validate the required tags up front — spec: never auto-assume payment_type.
  if (input.payment_type !== 'online' && input.payment_type !== 'offline') {
    return { error: 'يجب تحديد نوع الدفع: online أو offline' };
  }
  if (!input.branch_id) return { error: 'الفرع مطلوب' };

  const name = input.customer_full_name?.trim();
  const phone = input.customer_phone?.trim();
  if (!name) return { error: 'اسم العميل مطلوب' };
  if (!phone || phone.length < 6) return { error: 'رقم الهاتف غير صحيح' };

  const items = (input.items ?? []).filter((i) => i.book_id && i.quantity > 0);
  if (items.length === 0) return { error: 'يجب إضافة كتاب واحد على الأقل' };

  // Branch managers can only create orders for their own branch.
  if (ctx.role === 'branch_manager') {
    if (!ctx.branchId) return { error: 'مدير الفرع غير مرتبط بفرع' };
    if (input.branch_id !== ctx.branchId) {
      return { error: 'لا يمكنك إنشاء طلب لفرع آخر' };
    }
  }

  const admin = createAdminClient();

  // Resolve customer: dedup by phone — reuse if any student already has it.
  const { data: existing } = await admin
    .from('students')
    .select('id')
    .eq('phone', phone)
    .limit(1)
    .maybeSingle();

  let studentId: string;
  let reusedExisting = false;
  if (existing) {
    studentId = existing.id;
    reusedExisting = true;
  } else {
    const { data: created, error: createErr } = await admin
      .from('students')
      .insert({
        full_name: name,
        phone,
        grade_level: input.customer_grade_level ?? null,
        is_guest: true,
      })
      .select('id')
      .single();
    if (createErr || !created) {
      return { error: createErr?.message ?? 'فشل إنشاء العميل' };
    }
    studentId = created.id;
  }

  // Re-fetch book prices server-side (don't trust the client).
  const bookIds = Array.from(new Set(items.map((i) => i.book_id)));
  const { data: dbBooks } = await admin
    .from('books')
    .select('id, final_price, is_active')
    .in('id', bookIds);

  const priceMap = new Map((dbBooks ?? []).map((b) => [b.id, b]));
  for (const it of items) {
    const b = priceMap.get(it.book_id);
    if (!b || !b.is_active) {
      return { error: `كتاب غير متاح في القائمة (${it.book_id})` };
    }
  }

  const subtotal = items.reduce(
    (s, i) => s + i.quantity * Number(priceMap.get(i.book_id)!.final_price),
    0,
  );

  // Manual entry is always counter pickup, no shipping fee.
  const total = subtotal;

  // Stock Integrity gate: every line goes through validateStock(actor='staff').
  // Each call writes a stock_decisions row, so the audit trail is intact even
  // when the trigger ultimately handles the oversold_quantity bookkeeping.
  // We aggregate by book_id so the same SKU appearing twice doesn't double-warn.
  const aggregated = new Map<number, number>();
  for (const it of items) {
    aggregated.set(it.book_id, (aggregated.get(it.book_id) ?? 0) + it.quantity);
  }
  const oversells: OversellLine[] = [];
  for (const [bookId, qty] of aggregated.entries()) {
    const decision = await validateStock({
      actor_type: 'staff',
      action: 'set_quantity',
      book_id: bookId,
      requested_qty: qty,
      current_in_cart: 0,
      branch_id: input.branch_id,
      touchpoint: 'manual_order',
      note: input.staff_note ?? null,
    });
    if (decision.decision === 'block') {
      // Only fires for delisted/missing books — staff oversell can't otherwise block.
      return { error: decision.user_message ?? 'كتاب غير متاح' };
    }
    if (decision.decision === 'warn_and_allow') {
      oversells.push({
        book_id: bookId,
        title_ar: decision.title_ar,
        requested_qty: decision.effective_qty,
        available_stock: decision.available_stock,
        overage: decision.effective_qty - decision.available_stock,
        message: decision.user_message ?? '',
      });
    }
  }

  if (oversells.length > 0 && !input.oversell_confirmed) {
    return {
      requires_oversell_confirmation: true,
      oversells,
    };
  }

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      student_id: studentId,
      branch_id: input.branch_id,
      fulfillment_type: 'pickup',
      status: 'pending',
      shipping_fee: 0,
      subtotal,
      total,
      payment_method: input.payment_method,
      payment_status: 'pending',
      payment_type: input.payment_type,
      order_source: 'dashboard',
      notes: input.notes?.trim() || null,
    })
    .select('id, order_number')
    .single();

  if (orderErr || !order) {
    return { error: orderErr?.message ?? 'فشل إنشاء الطلب' };
  }

  // Inserting items triggers stock reservation + the per-student book cap check.
  const itemsPayload = items.map((i) => ({
    order_id: order.id,
    book_id: i.book_id,
    quantity: i.quantity,
    unit_price: Number(priceMap.get(i.book_id)!.final_price),
  }));

  const { error: itemsErr } = await admin.from('order_items').insert(itemsPayload);
  if (itemsErr) {
    await admin.from('orders').delete().eq('id', order.id);
    return { error: translateOrderError(itemsErr.message) };
  }

  // Counter sale: transition pending → completed so settle_stock_on_order_status
  // converts the reservation into a real stock deduction.
  if (input.sale_type === 'completed_at_counter') {
    const { error: updErr } = await admin
      .from('orders')
      .update({
        status: 'completed',
        payment_status: 'paid',
        reservation_expires_at: null,
      })
      .eq('id', order.id);

    if (updErr) {
      return {
        error: `الطلب أُنشئ لكن فشل تحويله إلى مكتمل: ${updErr.message}`,
        order_id: order.id,
        order_number: order.order_number,
      };
    }
  }

  revalidatePath('/admin/orders');
  return {
    order_id: order.id,
    order_number: order.order_number,
    reused_existing_customer: reusedExisting,
  };
}

function translateOrderError(msg: string): string {
  if (msg.includes('OUT_OF_STOCK')) return 'أحد الكتب غير متوفر بالكمية المطلوبة في هذا الفرع';
  if (msg.includes('BOOK_CAP_EXCEEDED')) return 'تجاوز العميل الحد الأقصى للكتب المسموح بها';
  return msg;
}
