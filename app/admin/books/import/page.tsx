import PageShell from '@/components/admin/page-shell';
import BulkImportForm from '@/components/admin/bulk-import-form';
import { requireFullAdmin } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'استيراد كتب CSV | الإدارة' };

export default async function ImportBooksPage() {
  await requireFullAdmin();
  const supa = await createClient();
  const { data: branches } = await supa
    .from('branches')
    .select('slug, name_ar')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <PageShell title="استيراد كتب من CSV" subtitle="أضف عشرات الكتب دفعة واحدة بملف Excel/CSV">
      <BulkImportForm branches={branches ?? []} />
    </PageShell>
  );
}
