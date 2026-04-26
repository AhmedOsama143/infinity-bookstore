import { createClient } from '@/lib/supabase/server';
import NotificationBell from './notification-bell';
import type { AdminContext } from '@/lib/admin/auth';

export default async function TopBar({ ctx }: { ctx: AdminContext }) {
  const supa = await createClient();
  let q = supa
    .from('notifications')
    .select('id, type, title_ar, body_ar, is_read, created_at, entity_type, entity_id')
    .order('created_at', { ascending: false })
    .limit(30);
  if (ctx.role === 'branch_manager' && ctx.branchId) q = q.eq('branch_id', ctx.branchId);
  const { data: notifs } = await q;

  return (
    <div className="h-16 bg-white border-b border-bg-light flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="text-sm text-[#666]">
        {ctx.role === 'admin' ? 'مالك المكتبة' : 'مدير الفرع'}
      </div>
      <NotificationBell
        initial={(notifs ?? []) as any}
        branchFilter={ctx.role === 'branch_manager' ? ctx.branchId : null}
      />
    </div>
  );
}
