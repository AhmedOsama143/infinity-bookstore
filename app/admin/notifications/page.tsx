import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { requireAdmin } from '@/lib/admin/auth';

const typeIcon: Record<string, string> = {
  new_order: 'fa-bag-shopping text-primary',
  reserved: 'fa-bookmark text-accent-dark',
  picked_up: 'fa-circle-check text-success',
  paid: 'fa-money-bill text-success',
  cod_collected: 'fa-coins text-success',
  low_stock: 'fa-triangle-exclamation text-accent-dark',
  cap_hit: 'fa-ban text-danger',
  new_student: 'fa-user-plus text-primary',
  return_request: 'fa-rotate-left text-accent-dark',
  order_cancelled: 'fa-ban text-danger',
};

export default async function AdminNotificationsPage() {
  const ctx = await requireAdmin();
  const supa = await createClient();

  let q = supa
    .from('notifications')
    .select('id, type, title_ar, body_ar, is_read, created_at, entity_type, entity_id, branch:branches(name_ar)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (ctx.role === 'branch_manager' && ctx.branchId) q = q.eq('branch_id', ctx.branchId);

  const { data: items } = await q;

  // Mark all as read
  if (items?.some((i) => !i.is_read)) {
    let updateQ = supa.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (ctx.role === 'branch_manager' && ctx.branchId) updateQ = updateQ.eq('branch_id', ctx.branchId);
    await updateQ;
  }

  return (
    <PageShell title="الإشعارات" subtitle={`${items?.length ?? 0} إشعار`}>
      {!items || items.length === 0 ? (
        <div className="card p-12 text-center">
          <i className="fa-regular fa-bell text-5xl text-primary-light block mb-4" />
          <p className="text-[#666]">لا توجد إشعارات بعد</p>
        </div>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {items.map((n: any) => {
            const icon = typeIcon[n.type] ?? 'fa-bell text-primary';
            const linkHref =
              n.entity_type === 'order' ? `/admin/orders/${n.entity_id}` : null;
            const inner = (
              <div className="card p-4 flex gap-4 hover:bg-bg-light/50 transition-colors">
                <i className={`fa-solid ${icon} text-2xl mt-1`} />
                <div className="flex-1">
                  <h3 className="font-bold">{n.title_ar}</h3>
                  {n.body_ar && <p className="text-sm text-[#666] mt-1">{n.body_ar}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#888]">
                    <span>{new Date(n.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    {n.branch?.name_ar && <span>• {n.branch.name_ar}</span>}
                  </div>
                </div>
              </div>
            );
            return linkHref ? <Link key={n.id} href={linkHref} className="block">{inner}</Link> : <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
    </PageShell>
  );
}
