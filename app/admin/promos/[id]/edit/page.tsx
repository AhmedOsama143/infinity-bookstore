import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import PromoForm from '@/components/admin/promo-form';
import { requireFullAdmin } from '@/lib/admin/auth';

interface Props { params: Promise<{ id: string }> }

export default async function EditPromoPage({ params }: Props) {
  await requireFullAdmin();
  const { id } = await params;
  const supa = await createClient();
  const { data: promo } = await supa.from('promo_codes').select('*').eq('id', id).maybeSingle();
  if (!promo) notFound();
  return (
    <PageShell title={`تعديل الكود: ${promo.code}`}>
      <PromoForm initial={promo as any} />
    </PageShell>
  );
}
