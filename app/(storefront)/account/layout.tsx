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
        <div className="container-app grid md:grid-cols-[240px_1fr] gap-8">
          <aside>
            <AccountNav />
          </aside>
          <div>{children}</div>
        </div>
      </section>
    </>
  );
}
