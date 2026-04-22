'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/lib/auth/actions';

const items = [
  { href: '/account', label: 'الملف الشخصي', icon: 'fa-user' },
  { href: '/account/orders', label: 'طلباتي', icon: 'fa-bag-shopping' },
  { href: '/wishlist', label: 'المفضلة', icon: 'fa-heart' },
  { href: '/account/notifications', label: 'الإشعارات', icon: 'fa-bell' },
];

export default function AccountNav() {
  const path = usePathname();
  return (
    <nav className="card p-3 md:p-0">
      <ul className="flex md:flex-col overflow-x-auto">
        {items.map((item) => {
          const active = path === item.href;
          return (
            <li key={item.href} className="flex-shrink-0">
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-primary-light text-primary-dark font-bold border-r-[3px] border-accent'
                    : 'text-ink hover:bg-bg-light'
                }`}
              >
                <i className={`fa-solid ${item.icon} w-4`} />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="md:mt-auto md:border-t md:border-bg-light">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-danger/5 transition-colors whitespace-nowrap"
            >
              <i className="fa-solid fa-right-from-bracket w-4" />
              تسجيل الخروج
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
