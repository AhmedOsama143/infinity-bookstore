import { getTeachers, getBooks } from '@/lib/data';
import TeacherCard from '@/components/storefront/teacher-card';
import PageHeader from '@/components/storefront/page-header';

export const metadata = { title: 'المدرسين | مركز إنفينيتي' };

export default async function TeachersPage() {
  const teachers = await getTeachers();
  const allBooks = await getBooks({});
  const countsByTeacher = new Map<number, number>();
  for (const b of allBooks) {
    if (b.teacher_id) {
      countsByTeacher.set(b.teacher_id, (countsByTeacher.get(b.teacher_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <PageHeader title="المدرسين" subtitle={`${teachers.length} مدرس من نخبة مدرسي الثانوية`} />

      <section className="section">
        <div className="container-app">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {teachers.map((t) => (
              <TeacherCard key={t.id} teacher={t} booksCount={countsByTeacher.get(t.id) ?? 0} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
