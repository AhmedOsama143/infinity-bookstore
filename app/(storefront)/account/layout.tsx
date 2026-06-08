import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AccountNav from '@/components/storefront/account-nav';
import PageHeader from '@/components/storefront/page-header';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login?next=/account');

  const { data: student } = await supa
    .from('students')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <>
      <PageHeader
        title="حسابي"
        subtitle={student?.full_name ?? student?.email ?? user.email ?? undefined}
      />
      <section className="section">
        <div className="container-app grid md:grid-cols-[220px_1fr] gap-5 md:gap-8">
          {/* min-w-0 lets these grid items shrink below their content's
              intrinsic width. Without it the nav's overflow-x-auto strip can't
              scroll, so its whitespace-nowrap items force the track ~756px wide
              and blow the whole page past the viewport on mobile. */}
          <aside className="min-w-0">
            <AccountNav />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </section>
    </>
  );
}
