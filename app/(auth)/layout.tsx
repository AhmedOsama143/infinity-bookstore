import Link from 'next/link';
import AnnouncementBar from '@/components/storefront/announcement-bar';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <header className="h-[70px] flex items-center shadow-card bg-white">
        <div className="container-app">
          <Link
            href="/"
            className="text-[1.4rem] font-extrabold text-primary-dark font-heading"
          >
            مكتبة <span className="text-accent font-bold">إنفينيتي</span>
          </Link>
        </div>
      </header>
      <main className="min-h-[calc(100vh-120px)] bg-bg-light py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full max-w-md px-4">{children}</div>
      </main>
    </>
  );
}
