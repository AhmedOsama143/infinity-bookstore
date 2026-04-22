import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'الإشعارات | مكتبة إنفينيتي' };

export default async function NotificationsPage() {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  const { data: items } = await supa
    .from('student_notifications_inbox')
    .select('id, type, title_ar, body_ar, is_read, created_at')
    .eq('student_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Mark all unread as read (simple approach; a dedicated action would be nicer)
  if (items?.some((i) => !i.is_read)) {
    await supa
      .from('student_notifications_inbox')
      .update({ is_read: true })
      .eq('student_id', user!.id)
      .eq('is_read', false);
  }

  if (!items || items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <i className="fa-regular fa-bell text-5xl text-primary-light mb-4 block" />
        <h2 className="text-xl font-bold mb-2">لا توجد إشعارات</h2>
        <p className="text-[#666]">ستصلك إشعارات بحالة طلباتك وتوفر الكتب هنا</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((n) => (
        <div key={n.id} className="card p-4 flex gap-4">
          <div className="w-10 h-10 rounded-full bg-primary-light text-primary-dark flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-bell" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold">{n.title_ar}</h3>
            {n.body_ar && <p className="text-sm text-[#666] mt-1">{n.body_ar}</p>}
            <p className="text-xs text-[#999] mt-2">
              {new Date(n.created_at).toLocaleString('ar-EG', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
