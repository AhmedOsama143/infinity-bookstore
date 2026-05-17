'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  { href: '/admin/payments',              label: 'دفعات فوري',           icon: 'fa-credit-card' },
  { href: '/admin/branches',              label: 'الفروع',               icon: 'fa-store' },
  { href: '/admin/books',                 label: 'الكتب',                icon: 'fa-book' },
  { href: '/admin/teachers',              label: 'المدرسين',             icon: 'fa-chalkboard-user', adminOnly: true },
  { href: '/admin/students',              label: 'الطلاب',               icon: 'fa-users',           adminOnly: true },
  { href: '/admin/reviews',               label: 'مراجعات الكتب',         icon: 'fa-star',            adminOnly: true },
  { href: '/admin/returns',               label: 'الإرجاعات',            icon: 'fa-rotate-left' },
  { href: '/admin/transfers',             label: 'نقل المخزون',           icon: 'fa-right-left',      adminOnly: true },
  { href: '/admin/promos',                label: 'أكواد الخصم',           icon: 'fa-tag',             adminOnly: true },
  { href: '/admin/shipping',              label: 'الشحن والتوصيل',       icon: 'fa-truck',           adminOnly: true },
  { href: '/admin/content',               label: 'محتوى الموقع',          icon: 'fa-file-pen',        adminOnly: true },
  { href: '/admin/audit',                 label: 'سجل التدقيق',           icon: 'fa-shield-halved',   adminOnly: true },
  { href: '/admin/notifications',         label: 'الإشعارات',            icon: 'fa-bell' },
  { href: '/admin/settings',              label: 'الإعدادات',             icon: 'fa-gear',            adminOnly: true },
];

export default function Sidebar({ role, email }: { role: AdminRole; email: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const visible = items.filter((i) => !i.adminOnly || role === 'admin');

  useEffect(() => { setOpen(false); }, [path]);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-50 w-10 h-10 bg-white shadow-card rounded-full flex items-center justify-center text-primary-dark"
        aria-label="فتح القائمة"
      >
        <i className="fa-solid fa-bars" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`bg-white border-l border-bg-light w-[240px] min-h-screen flex flex-col shrink-0 sticky top-0 z-50 transition-transform duration-200 ${
        open ? 'fixed inset-y-0 right-0 translate-x-0' : 'fixed inset-y-0 right-0 translate-x-full lg:translate-x-0 lg:static'
      }`}>
        <div className="p-5 border-b border-bg-light flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-xl font-extrabold text-primary-dark font-heading">
              مركز <span className="text-accent">إنفينيتي</span>
            </Link>
            <div className="text-xs text-[#888] mt-1">
              لوحة {role === 'admin' ? 'المالك' : 'مدير الفرع'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="lg:hidden text-[#888] hover:text-ink text-lg"
            aria-label="إغلاق القائمة"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          <ul>
            {visible.map((item) => {
              const active = path === item.href || (item.href !== '/admin' && path.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-5 py-3 transition-colors text-sm ${
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
    </>
  );
}
