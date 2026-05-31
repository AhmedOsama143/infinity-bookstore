import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/auth';

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // CSV/Excel formula-injection guard: a cell that begins with =, +, -, @, or a
  // leading tab/CR is interpreted as a formula by spreadsheet apps. Student-
  // supplied fields (name, phone, email) flow into these exports, so neutralise
  // by prefixing a single quote, which spreadsheets render as plain text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(csvEscape).join(',');
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(',')).join('\n');
  // BOM so Excel renders Arabic correctly
  return '\uFEFF' + header + '\n' + body;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const ctx = await requireAdmin();
  const { type } = await params;
  const supa = await createClient();

  let csv = '';
  const filename = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;

  if (type === 'orders') {
    let q = supa
      .from('orders')
      .select('order_number, status, fulfillment_type, payment_method, payment_status, total, subtotal, shipping_fee, shipping_governorate, created_at, branch:branches(name_ar), student:students(full_name, phone, email)')
      .order('created_at', { ascending: false });
    if (ctx.role === 'branch_manager' && ctx.branchId) q = q.eq('branch_id', ctx.branchId);
    const { data } = await q;
    const rows = (data ?? []).map((o: any) => ({
      'رقم الطلب': o.order_number,
      'التاريخ': new Date(o.created_at).toLocaleString('ar-EG'),
      'الحالة': o.status,
      'النوع': o.fulfillment_type,
      'الدفع': o.payment_method,
      'حالة الدفع': o.payment_status,
      'الإجمالي': o.total,
      'الفرعي': o.subtotal,
      'الشحن': o.shipping_fee,
      'المحافظة': o.shipping_governorate ?? '',
      'الفرع': o.branch?.name_ar ?? '',
      'الطالب': o.student?.full_name ?? '',
      'الهاتف': o.student?.phone ?? '',
      'الإيميل': o.student?.email ?? '',
    }));
    csv = rowsToCsv(rows, Object.keys(rows[0] ?? {
      'رقم الطلب': '', 'التاريخ': '', 'الحالة': '', 'النوع': '', 'الدفع': '',
    }));
  } else if (type === 'students' && ctx.role === 'admin') {
    const { data } = await supa
      .from('students')
      .select('full_name, phone, email, grade_level, governorate, books_ordered_count, auth_provider, created_at');
    const rows = (data ?? []).map((s: any) => ({
      'الاسم': s.full_name ?? '',
      'الهاتف': s.phone ?? '',
      'الإيميل': s.email ?? '',
      'الصف': s.grade_level ?? '',
      'المحافظة': s.governorate ?? '',
      'كتب مطلوبة': s.books_ordered_count,
      'تسجيل': s.auth_provider ?? '',
      'تاريخ التسجيل': new Date(s.created_at).toLocaleString('ar-EG'),
    }));
    csv = rowsToCsv(rows, [
      'الاسم', 'الهاتف', 'الإيميل', 'الصف', 'المحافظة',
      'كتب مطلوبة', 'تسجيل', 'تاريخ التسجيل',
    ]);
  } else if (type === 'inventory') {
    let q = supa
      .from('branch_stock')
      .select('quantity, reserved_quantity, branch:branches(name_ar), book:books(id, title_ar, final_price)');
    if (ctx.role === 'branch_manager' && ctx.branchId) q = q.eq('branch_id', ctx.branchId);
    const { data } = await q;
    const rows = (data ?? []).map((r: any) => ({
      'معرف الكتاب': r.book?.id,
      'العنوان': r.book?.title_ar,
      'الفرع': r.branch?.name_ar,
      'الكمية الكلية': r.quantity,
      'محجوز': r.reserved_quantity,
      'متاح': r.quantity - r.reserved_quantity,
      'سعر الوحدة': r.book?.final_price,
      'قيمة المخزون': (r.book?.final_price ?? 0) * r.quantity,
    }));
    csv = rowsToCsv(rows, [
      'معرف الكتاب', 'العنوان', 'الفرع', 'الكمية الكلية',
      'محجوز', 'متاح', 'سعر الوحدة', 'قيمة المخزون',
    ]);
  } else {
    return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
