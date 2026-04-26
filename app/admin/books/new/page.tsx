import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import BookForm from '@/components/admin/book-form';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function NewBookPage() {
  await requireFullAdmin();
  const supa = await createClient();
  const [{ data: teachers }, { data: branches }] = await Promise.all([
    supa.from('teachers').select('id, name_ar').order('name_ar'),
    supa.from('branches').select('id, name_ar').eq('is_active', true).order('sort_order'),
  ]);
  return (
    <PageShell title="إضافة كتاب جديد">
      <BookForm
        mode="new"
        teachers={teachers ?? []}
        branches={branches ?? []}
        branchStock={{}}
      />
    </PageShell>
  );
}
