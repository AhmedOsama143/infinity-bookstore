'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moderateReview } from '@/lib/admin/review-actions';

export default function ReviewRow({ review }: { review: any }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function go(status: 'approved' | 'rejected') {
    setErr(null);
    start(async () => {
      const res = await moderateReview(review.id, status);
      if (res?.error) setErr(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="font-bold">{review.book?.title_ar ?? '—'}</div>
          <div className="text-xs text-[#666]">
            {review.student?.full_name ?? 'طالب'} •{' '}
            {new Date(review.created_at).toLocaleDateString('ar-EG', { dateStyle: 'short' })}
          </div>
        </div>
        <div className="text-accent text-lg" aria-label={`${review.rating} من 5`}>
          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
        </div>
      </div>
      {review.title_ar && <h3 className="font-bold mb-1">{review.title_ar}</h3>}
      {review.body_ar && <p className="text-sm text-ink/80 mb-3">{review.body_ar}</p>}
      {err && <div className="bg-danger/10 text-danger text-sm p-2 rounded-s mb-3">{err}</div>}
      {review.status === 'pending' ? (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => go('approved')} className="btn btn-primary text-sm py-1.5 px-5 disabled:opacity-50">
            موافقة
          </button>
          <button type="button" disabled={busy} onClick={() => go('rejected')} className="btn border-2 border-danger text-danger px-5 py-1.5 rounded-pill font-bold text-sm hover:bg-danger hover:text-white disabled:opacity-50">
            رفض
          </button>
        </div>
      ) : (
        <span className={`text-xs font-bold ${review.status === 'approved' ? 'text-success' : 'text-danger'}`}>
          {review.status === 'approved' ? '✓ موافق عليه' : '✗ مرفوض'}
        </span>
      )}
    </div>
  );
}
