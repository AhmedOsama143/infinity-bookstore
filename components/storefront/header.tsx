import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const navItems = [
  { href: '/', label: 'الرئيسية' },
  { href: '/books', label: 'الكتب' },
  { href: '/teachers', label: 'المدرسين' },
  { href: '/grade-level', label: 'الصفوف' },
  { href: '/delivery', label: 'الشحن' },
  { href: '/about', label: 'من نحن' },
];

export default async function Header() {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  let fullName: string | null = null;
  if (user) {
    const { data: student } = await supa
      .from('students')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    fullName = student?.full_name ?? user.email ?? null;
  }

  return (
    <header className="sticky top-0 bg-white z-40 h-[70px] flex items-center shadow-card">
      <div className="container-app flex items-center justify-between w-full">
        <Link
          href="/"
          className="text-[1.4rem] font-extrabold text-primary-dark font-heading shrink-0"
        >
          مكتبة <span className="text-accent font-bold">إنفينيتي</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink hover:text-primary transition-colors text-[.95rem] font-medium font-body"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/search" className="text-ink hover:text-primary text-lg px-2" aria-label="بحث">
            <i className="fa-solid fa-magnifying-glass" />
          </Link>
          <Link href="/wishlist" className="text-ink hover:text-primary text-lg px-2" aria-label="المفضلة">
            <i className="fa-regular fa-heart" />
          </Link>
          <Link href="/cart" className="text-ink hover:text-primary text-lg px-2" aria-label="السلة">
            <i className="fa-solid fa-cart-shopping" />
          </Link>

          {user ? (
            <Link
              href="/account"
              className="flex items-center gap-2 bg-primary-light text-primary-dark px-4 py-1.5 rounded-pill font-semibold text-sm hover:bg-primary hover:text-white transition-colors max-w-[150px]"
            >
              <i className="fa-solid fa-user text-xs" />
              <span className="truncate">{fullName ?? 'حسابي'}</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline text-sm hidden sm:inline-block">دخول</Link>
              <Link href="/register" className="btn btn-primary text-sm">تسجيل</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
