import PageShell from '@/components/admin/page-shell';
import TwoFactorSection from '@/components/admin/two-factor-section';
import BranchManagersSection from '@/components/admin/branch-managers-section';
import { requireFullAdmin } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'الإعدادات | الإدارة' };

export default async function AdminSettingsPage() {
  await requireFullAdmin();

  const supa = await createClient();
  const [
    { data: { user } },
    { data: branches },
    { data: managers },
  ] = await Promise.all([
    supa.auth.getUser(),
    supa.from('branches').select('id, name_ar').eq('is_active', true).order('sort_order'),
    supa
      .from('admin_users')
      .select('id, role, branch_id, mfa_enabled, created_at, branch:branches(name_ar)')
      .eq('role', 'branch_manager')
      .order('created_at', { ascending: false }),
  ]);

  // Pull each manager's email from the auth schema (only the service-role client can read it)
  let managersWithEmail: any[] = managers ?? [];
  if (managers && managers.length > 0) {
    const admin = createAdminClient();
    managersWithEmail = await Promise.all(
      managers.map(async (m: any) => {
        const { data } = await admin.auth.admin.getUserById(m.id);
        return { ...m, email: data?.user?.email ?? null };
      })
    );
  }

  // Existing TOTP factors for the current admin
  const factors = await supa.auth.mfa.listFactors();
  const totpFactor = factors.data?.totp?.[0] ?? null;

  return (
    <PageShell title="الإعدادات" subtitle="حماية الحساب وإدارة الفريق">
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <TwoFactorSection
          email={user?.email ?? null}
          enrolled={!!totpFactor && totpFactor.status === 'verified'}
          factorId={totpFactor?.id ?? null}
          factorStatus={totpFactor?.status ?? null}
        />
        <BranchManagersSection branches={branches ?? []} managers={managersWithEmail} />
      </div>
    </PageShell>
  );
}
