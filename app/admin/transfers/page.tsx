import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import TransferForm from '@/components/admin/transfer-form';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function TransfersPage() {
  await requireFullAdmin();
  const supa = await createClient();
  const [{ data: branches }, { data: books }, { data: history }] = await Promise.all([
    supa.from('branches').select('id, name_ar').eq('is_active', true).order('sort_order'),
    supa.from('books').select('id, title_ar').eq('is_active', true).order('id', { ascending: false }).limit(500),
    supa
      .from('stock_transfers')
      .select('id, quantity, status, created_at, completed_at, notes, from:branches!from_branch(name_ar), to:branches!to_branch(name_ar), book:books(title_ar)')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return (
    <PageShell title="نقل المخزون بين الفروع">
      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        <TransferForm branches={branches ?? []} books={books ?? []} />

        <div className="card p-5">
          <h2 className="font-bold text-primary-dark mb-4">آخر عمليات النقل</h2>
          {(!history || history.length === 0) ? (
            <p className="text-center text-[#666] text-sm py-6">لا توجد عمليات بعد</p>
          ) : (
            <ul className="divide-y divide-bg-light text-sm max-h-[480px] overflow-y-auto">
              {history.map((t: any) => (
                <li key={t.id} className="py-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold">{t.book?.title_ar}</span>
                    <span className="text-xs text-[#666]">
                      {new Date(t.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="text-xs text-[#666]">
                    {t.from?.name_ar} <i className="fa-solid fa-arrow-left mx-1" /> {t.to?.name_ar}
                    {' • '}
                    <strong className="text-primary-dark">{t.quantity} نسخة</strong>
                    {' • '}
                    <span className={t.status === 'completed' ? 'text-success' : t.status === 'cancelled' ? 'text-danger' : 'text-accent-dark'}>
                      {t.status === 'completed' ? '✓ تم' : t.status === 'cancelled' ? '✗ ألغي' : '⏳ قيد التنفيذ'}
                    </span>
                  </div>
                  {t.notes && <p className="text-xs text-[#888] mt-1">{t.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}
