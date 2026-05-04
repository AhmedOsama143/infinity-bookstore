import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import ManualOrderForm from '@/components/admin/manual-order-form';
import { requireAdmin } from '@/lib/admin/auth';

export const metadata = { title: 'طلب يدوي جديد | لوحة الإدارة' };

export default async function NewManualOrderPage() {
  const ctx = await requireAdmin();
  const supa = await createClient();

  const [{ data: branches }, { data: books }, { data: stock }] = await Promise.all([
    supa.from('branches').select('id, name_ar').eq('is_active', true).order('sort_order'),
    supa
      .from('books')
      .select('id, title_ar, final_price, grade_level, teacher:teachers(name_ar)')
      .eq('is_active', true)
      .order('title_ar'),
    supa.from('branch_stock').select('branch_id, book_id, quantity, reserved_quantity'),
  ]);

  // available[branch_id][book_id] = quantity - reserved
  const available: Record<string, Record<number, number>> = {};
  for (const row of stock ?? []) {
    const avail = Math.max(0, (row.quantity ?? 0) - (row.reserved_quantity ?? 0));
    (available[row.branch_id] ??= {})[row.book_id] = avail;
  }

  // Branch managers can only create for their own branch.
  const visibleBranches =
    ctx.role === 'branch_manager' && ctx.branchId
      ? (branches ?? []).filter((b) => b.id === ctx.branchId)
      : (branches ?? []);

  return (
    <PageShell
      title="طلب يدوي جديد"
      subtitle="إنشاء طلب نيابةً عن العميل (بيع داخل الفرع أو طلب هاتفي)"
    >
      <ManualOrderForm
        branches={visibleBranches}
        books={(books ?? []) as any}
        available={available}
        defaultBranchId={ctx.role === 'branch_manager' ? ctx.branchId : null}
      />
    </PageShell>
  );
}
