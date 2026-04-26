import PageShell from '@/components/admin/page-shell';
import PromoForm from '@/components/admin/promo-form';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function NewPromoPage() {
  await requireFullAdmin();
  return (
    <PageShell title="كود خصم جديد">
      <PromoForm />
    </PageShell>
  );
}
