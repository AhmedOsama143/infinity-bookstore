import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import TeacherForm from '@/components/admin/teacher-form';
import { requireFullAdmin } from '@/lib/admin/auth';

interface Props { params: Promise<{ id: string }> }

export default async function EditTeacherPage({ params }: Props) {
  await requireFullAdmin();
  const { id } = await params;
  const teacherId = Number(id);
  const supa = await createClient();
  const { data: teacher } = await supa.from('teachers').select('*').eq('id', teacherId).maybeSingle();
  if (!teacher) notFound();
  return (
    <PageShell title={`تعديل المدرس: ${teacher.name_ar}`}>
      <TeacherForm mode="edit" initial={teacher as any} />
    </PageShell>
  );
}
