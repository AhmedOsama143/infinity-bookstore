import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import ReviewRow from '@/components/admin/review-row';
import { requireFullAdmin } from '@/lib/admin/auth';

interface Props { searchParams: Promise<{ status?: string }> }

export default async function ReviewsPage({ searchParams }: Props) {
  await requireFullAdmin();
  const params = await searchParams;
  const status = params.status ?? 'pending';
  const supa = await createClient();

  let q = supa
    .from('reviews')
    .select('id, rating, title_ar, body_ar, status, created_at, book:books(id, title_ar), student:students(full_name)')
    .order('created_at', { ascending: false });
  if (status !== 'all') q = q.eq('status', status);

  const { data: reviews } = await q;

  return (
    <PageShell title="مراجعات الكتب" subtitle={`${reviews?.length ?? 0} مراجعة`}>
      <div className="flex gap-2 mb-5">
        {[
          { v: 'pending', label: 'قيد المراجعة' },
          { v: 'approved', label: 'موافق عليها' },
          { v: 'rejected', label: 'مرفوضة' },
          { v: 'all', label: 'الكل' },
        ].map((t) => (
          <Link
            key={t.v}
            href={`/admin/reviews?status=${t.v}`}
            className={`px-4 py-2 rounded-pill text-sm font-bold ${status === t.v ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-light'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {(!reviews || reviews.length === 0) ? (
        <div className="card p-12 text-center text-[#666]">
          <i className="fa-regular fa-comments text-5xl text-primary-light block mb-4" />
          لا توجد مراجعات في هذه الفئة
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {reviews.map((r: any) => <ReviewRow key={r.id} review={r} />)}
        </div>
      )}
    </PageShell>
  );
}
