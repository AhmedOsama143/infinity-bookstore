import PageShell from '@/components/admin/page-shell';
import TeacherForm from '@/components/admin/teacher-form';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function NewTeacherPage() {
  await requireFullAdmin();
  return (
    <PageShell title="إضافة مدرس جديد">
      <TeacherForm mode="new" />
    </PageShell>
  );
}
