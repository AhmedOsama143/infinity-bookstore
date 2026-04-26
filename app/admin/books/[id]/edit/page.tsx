import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import BookForm from '@/components/admin/book-form';
import { requireFullAdmin } from '@/lib/admin/auth';

interface Props { params: Promise<{ id: string }> }

export default async function EditBookPage({ params }: Props) {
  await requireFullAdmin();
  const { id } = await params;
  const bookId = Number(id);
  const supa = await createClient();

  const [{ data: book }, { data: teachers }, { data: branches }, { data: stockRows }] = await Promise.all([
    supa.from('books').select('*').eq('id', bookId).maybeSingle(),
    supa.from('teachers').select('id, name_ar').order('name_ar'),
    supa.from('branches').select('id, name_ar').eq('is_active', true).order('sort_order'),
    supa.from('branch_stock').select('branch_id, quantity').eq('book_id', bookId),
  ]);

  if (!book) notFound();
  const branchStock: Record<string, number> = {};
  for (const r of stockRows ?? []) branchStock[r.branch_id] = r.quantity;

  return (
    <PageShell title={`تعديل الكتاب: ${book.title_ar}`}>
      <BookForm
        mode="edit"
        initial={{
          id: book.id,
          title_ar: book.title_ar,
          teacher_id: book.teacher_id,
          grade_level: book.grade_level,
          book_type: book.book_type,
          description: book.description,
          price: Number(book.price),
          discount_pct: Number(book.discount_pct),
          weight_grams: book.weight_grams,
          publish_year: book.publish_year,
          isbn: book.isbn,
          is_active: book.is_active,
          cover_url: book.cover_url,
        }}
        teachers={teachers ?? []}
        branches={branches ?? []}
        branchStock={branchStock}
      />
    </PageShell>
  );
}
