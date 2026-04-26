import { createClient } from '@/lib/supabase/server';

export default async function ReviewsSection({ bookId }: { bookId: number }) {
  const supa = await createClient();
  const { data: reviews } = await supa
    .from('reviews')
    .select('id, rating, title_ar, body_ar, created_at, student:students(full_name)')
    .eq('book_id', bookId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!reviews || reviews.length === 0) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title text-right mb-0">المراجعات</h2>
        <div className="text-left">
          <div className="text-2xl font-extrabold text-accent-dark">{avg.toFixed(1)}<span className="text-sm text-[#666]">/5</span></div>
          <div className="text-xs text-[#666]">{reviews.length} مراجعة</div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {reviews.map((r: any) => (
          <div key={r.id} className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">{r.student?.full_name ?? 'طالب'}</span>
              <span className="text-accent" aria-label={`${r.rating} من 5`}>
                {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
              </span>
            </div>
            {r.title_ar && <h3 className="font-bold mb-1">{r.title_ar}</h3>}
            {r.body_ar && <p className="text-sm text-ink/80 leading-relaxed">{r.body_ar}</p>}
            <p className="text-xs text-[#888] mt-2">
              {new Date(r.created_at).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
