import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { formatPrice, gradeLabelAr } from '@/lib/utils';
import type { GradeLevel } from '@/lib/types';
import { requireAdmin } from '@/lib/admin/auth';

interface Props { searchParams: Promise<{ grade?: string; review?: string }> }

export default async function AdminBooksPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const supa = await createClient();

  let q = supa
    .from('books')
    .select('id, title_ar, grade_level, price, discount_pct, final_price, needs_review, is_active, teacher:teachers(name_ar)')
    .order('id', { ascending: false });

  if (params.grade) q = q.eq('grade_level', params.grade);
  if (params.review === '1') q = q.eq('needs_review', true);

  const { data: books } = await q;

  // Aggregate per-book stock across branches
  const ids = (books ?? []).map((b) => b.id);
  const { data: stockRows } = await supa
    .from('branch_stock')
    .select('book_id, quantity, reserved_quantity')
    .in('book_id', ids);
  const stockMap = new Map<number, number>();
  for (const r of stockRows ?? []) {
    stockMap.set(r.book_id, (stockMap.get(r.book_id) ?? 0) + (r.quantity - r.reserved_quantity));
  }

  return (
    <PageShell
      title="الكتب"
      subtitle={`${books?.length ?? 0} كتاب`}
      actions={
        <Link href="/admin/books/new" className="btn bg-white text-primary-dark hover:bg-bg-light px-5 py-2 text-sm">
          <i className="fa-solid fa-plus ml-2" />
          إضافة كتاب جديد
        </Link>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Link href="/admin/books" className={`px-4 py-2 rounded-pill text-sm font-bold ${!params.grade && !params.review ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-light'}`}>الكل</Link>
        {(['first_secondary', 'second_secondary', 'third_secondary'] as GradeLevel[]).map((g) => (
          <Link key={g} href={`/admin/books?grade=${g}`} className={`px-4 py-2 rounded-pill text-sm font-bold ${params.grade === g ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-light'}`}>
            {gradeLabelAr[g]}
          </Link>
        ))}
        <Link href="/admin/books?review=1" className={`px-4 py-2 rounded-pill text-sm font-bold ${params.review === '1' ? 'bg-accent text-white' : 'bg-white text-accent-dark hover:bg-accent/10'}`}>
          ⚠️ تحتاج مراجعة
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary-light text-primary-dark text-xs">
            <tr>
              <th className="text-right p-3 w-12">#</th>
              <th className="text-right p-3">العنوان</th>
              <th className="text-right p-3">المدرس</th>
              <th className="text-right p-3">الصف</th>
              <th className="text-right p-3">السعر</th>
              <th className="text-center p-3">المتاح</th>
              <th className="text-center p-3">حالة</th>
            </tr>
          </thead>
          <tbody>
            {(books ?? []).map((b: any) => {
              const stock = stockMap.get(b.id) ?? 0;
              return (
                <tr key={b.id} className="border-b border-bg-light hover:bg-bg-light/50 last:border-0">
                  <td className="p-3 text-[#888]">{b.id}</td>
                  <td className="p-3">
                    <Link href={`/admin/books/${b.id}/edit`} className="font-bold hover:text-primary">
                      {b.title_ar}
                    </Link>
                    {b.needs_review && <span className="block text-[10px] text-accent-dark mt-0.5">⚠️ تحتاج مراجعة</span>}
                  </td>
                  <td className="p-3 text-xs">{b.teacher?.name_ar ?? '—'}</td>
                  <td className="p-3 text-xs">{gradeLabelAr[b.grade_level as GradeLevel]}</td>
                  <td className="p-3 font-bold text-accent-dark">{formatPrice(Number(b.final_price))}</td>
                  <td className={`p-3 text-center font-bold ${stock === 0 ? 'text-danger' : stock <= 5 ? 'text-accent-dark' : 'text-primary-dark'}`}>
                    {stock}
                  </td>
                  <td className="p-3 text-center text-xs">
                    {b.is_active ? <span className="text-success">✓ نشط</span> : <span className="text-danger">✗ معطل</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
