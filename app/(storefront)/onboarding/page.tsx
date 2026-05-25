import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import GradeOnboardingForm from '@/components/account/grade-onboarding-form';
import PageHeader from '@/components/storefront/page-header';
import { safeNextPath } from '@/lib/auth/safe-next';

export const metadata = { title: 'مرحبًا بك في إنفينيتي' };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login?next=/onboarding');

  const { data: student } = await supa
    .from('students')
    .select('grade_level, full_name')
    .eq('id', user.id)
    .maybeSingle();

  // If grade is already set, send them on
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (student?.grade_level) {
    redirect(next);
  }

  return (
    <>
      <PageHeader title="أهلاً بك" subtitle="اختر صفك الدراسي لنخصّص لك الكتب المناسبة" />
      <section className="section">
        <div className="container-app max-w-xl">
          <GradeOnboardingForm
            initialName={student?.full_name ?? ''}
            next={next}
          />
        </div>
      </section>
    </>
  );
}
