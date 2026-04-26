import Sidebar from '@/components/admin/sidebar';
import { requireAdmin } from '@/lib/admin/auth';

export const metadata = { title: 'لوحة الإدارة | مكتبة إنفينيتي' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  return (
    <div className="flex min-h-screen bg-bg-light" dir="rtl">
      <Sidebar role={ctx.role} email={ctx.email} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
