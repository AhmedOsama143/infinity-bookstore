'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/lib/auth/actions';
import type { AdminRole } from '@/lib/admin/types';

interface Item {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const items: Item[] = [
  { href: '/admin',                       label: 'الرئيسية',           icon: 'fa-gauge-high' },
  { href: '/admin/orders',                label: 'الطلبات',             icon: 'fa-bag-shopping' },
  { href: '/admin/analytics/orders',      label: 'تحليلات الطلبات',     icon: 'fa-chart-line' },
  { href: '/admin/analytics/payments',    label: 'الدفعات والحجوزات',   icon: 'fa-coins' },
  { href: '/admin/branches',              label: 'الفروع',               icon: 'fa-store' },
  { href: '/admin/books',                 label: 'الكتب',                icon: 'fa-book' },
  { href: '/admin/teachers',              label: 'المدرسين',             icon: 'fa-chalkboard-user', adminOnly: true },
  { href: '/admin/students',              label: 'الطلاب',               icon: 'fa-users',           adminOnly: true },
  { href: '/admin/returns',               label: 'الإرجاعات',            icon: 'fa-rotate-left' },
  { href: '/admin/shipping',              label: 'الشحن والتوصيل',       icon: 'fa-truck',           adminOnly: true },
  { href: '/admin/content',               label: 'محتوى الموقع',          icon: 'fa-file-pen',        adminOnly: true },
  { href: '/admin/notifications',         label: 'الإشعارات',            icon: 'fa-bell' },
];

export default function Sidebar({ role, email }: { role: AdminRole; email: string | null }) {
  const path = usePathname();
  const visible = items.filter((i) => !i.adminOnly || role === 'admin');

  return (
    <aside className="bg-white border-l border-bg-light w-[240px] min-h-screen flex flex-col shrink-0 sticky top-0">
      <div className="p-5 border-b border-bg-light">
        <Link href="/admin" className="text-xl font-extrabold text-primary-dark font-heading">
          مكتبة <span className="text-accent">إنفينيتي</span>
        </Link>
        <div className="text-xs text-[#888] mt-1">
          لوحة {role === 'admin' ? 'المالك' : 'مدير الفرع'}
        </div>
      </div>

      <nav className="flex-1 py-2">
        <ul>
          {visible.map((item) => {
            const active = path === item.href || (item.href !== '/admin' && path.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    active
                      ? 'bg-primary-light text-primary-dark font-bold border-r-[3px] border-accent'
                      : 'text-ink hover:bg-bg-light'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} w-4 text-center`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-bg-light">
        {email && <div className="text-xs text-[#666] mb-2 truncate px-2">{email}</div>}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 text-danger hover:bg-danger/5 rounded-s text-sm"
          >
            <i className="fa-solid fa-right-from-bracket" />
            تسجيل الخروج
          </button>
        </form>
      </div>
    </aside>
  );
}
