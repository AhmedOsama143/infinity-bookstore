'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'الرئيسية', icon: 'fa-house' },
  { href: '/books', label: 'الكتب', icon: 'fa-book' },
  { href: '/teachers', label: 'المدرسين', icon: 'fa-chalkboard-user' },
  { href: '/grade-level', label: 'الصفوف', icon: 'fa-graduation-cap' },
  { href: '/delivery', label: 'الشحن', icon: 'fa-truck' },
  { href: '/about', label: 'من نحن', icon: 'fa-circle-info' },
  { href: '/faq', label: 'الأسئلة الشائعة', icon: 'fa-circle-question' },
];

interface Props {
  isLoggedIn: boolean;
  fullName: string | null;
  unreadCount: number;
}

export default function MobileMenu({ isLoggedIn, fullName, unreadCount }: Props) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => { setOpen(false); }, [path]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden text-ink text-xl px-1.5"
        aria-label="فتح القائمة"
      >
        <i className="fa-solid fa-bars" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setOpen(false)} />
      )}

      <div className={`fixed inset-y-0 right-0 w-[280px] bg-white z-50 shadow-card-lg transform transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      } md:hidden`}>
        <div className="flex items-center justify-between p-4 border-b border-bg-light">
          <span className="text-lg font-extrabold text-primary-dark font-heading">
            مكتبة <span className="text-accent">إنفينيتي</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[#888] text-xl hover:text-ink"
            aria-label="إغلاق"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {isLoggedIn && (
          <Link
            href="/account"
            className="flex items-center gap-3 px-5 py-4 border-b border-bg-light bg-primary-light/50"
          >
            <div className="w-10 h-10 bg-primary-light text-primary-dark rounded-full flex items-center justify-center">
              <i className="fa-solid fa-user" />
            </div>
            <div>
              <div className="font-bold text-sm">{fullName ?? 'حسابي'}</div>
              <div className="text-xs text-[#666]">عرض الملف الشخصي</div>
            </div>
          </Link>
        )}

        <nav className="py-2 overflow-y-auto max-h-[calc(100vh-180px)]">
          <ul>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                    path === item.href
                      ? 'bg-primary-light text-primary-dark font-bold'
                      : 'text-ink hover:bg-bg-light'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} w-5 text-center text-primary`} />
                  {item.label}
                </Link>
              </li>
            ))}

            <li className="border-t border-bg-light mt-2 pt-2">
              <Link href="/wishlist" className="flex items-center gap-3 px-5 py-3 text-sm text-ink hover:bg-bg-light">
                <i className="fa-regular fa-heart w-5 text-center text-primary" />
                المفضلة
              </Link>
            </li>

            {isLoggedIn && (
              <>
                <li>
                  <Link href="/account/notifications" className="flex items-center gap-3 px-5 py-3 text-sm text-ink hover:bg-bg-light">
                    <i className="fa-regular fa-bell w-5 text-center text-primary" />
                    الإشعارات
                    {unreadCount > 0 && (
                      <span className="bg-accent text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center mr-auto">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link href="/account/orders" className="flex items-center gap-3 px-5 py-3 text-sm text-ink hover:bg-bg-light">
                    <i className="fa-solid fa-bag-shopping w-5 text-center text-primary" />
                    طلباتي
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        {!isLoggedIn && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-bg-light bg-white flex gap-2">
            <Link href="/login" className="btn btn-outline flex-1 text-center text-sm py-2.5">دخول</Link>
            <Link href="/register" className="btn btn-primary flex-1 text-center text-sm py-2.5">تسجيل</Link>
          </div>
        )}
      </div>
    </>
  );
}
