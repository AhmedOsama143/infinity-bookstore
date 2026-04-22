import Link from 'next/link';
import type { GradeLevel } from '@/lib/types';
import { getBooks, getAvailabilitySummary, getTeachers } from '@/lib/data';
import { gradeLabelAr } from '@/lib/utils';
import BookCard from '@/components/storefront/book-card';
import PageHeader from '@/components/storefront/page-header';

const GRADES: { value: GradeLevel; label: string }[] = [
  { value: 'first_secondary', label: gradeLabelAr.first_secondary },
  { value: 'second_secondary', label: gradeLabelAr.second_secondary },
  { value: 'third_secondary', label: gradeLabelAr.third_secondary },
];

export const metadata = { title: 'الكتب | مكتبة إنفينيتي' };

interface PageProps {
  searchParams: Promise<{ grade?: string; teacher?: string; search?: string }>;
}

export default async function BooksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    grade: params.grade as GradeLevel | undefined,
    teacher_id: params.teacher ? parseInt(params.teacher, 10) : undefined,
    search: params.search || undefined,
  };

  const [books, teachers] = await Promise.all([getBooks(filters), getTeachers()]);
  const availability = await getAvailabilitySummary(books.map((b) => b.id));

  return (
    <>
      <PageHeader title="كتب المدرسين" subtitle={`${books.length} كتاب متاح للطلب`} />

      <section className="section">
        <div className="container-app">
          <div className="grid md:grid-cols-[240px_1fr] gap-8">
            {/* Sidebar filters */}
            <aside className="space-y-6">
              <div className="card p-5">
                <h3 className="font-bold mb-3 text-primary-dark">الصف الدراسي</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/books"
                      className={`block ${!filters.grade ? 'text-primary font-bold' : 'text-ink hover:text-primary'}`}
                    >
                      الكل
                    </Link>
                  </li>
                  {GRADES.map((g) => (
                    <li key={g.value}>
                      <Link
                        href={`/books?grade=${g.value}`}
                        className={`block ${filters.grade === g.value ? 'text-primary font-bold' : 'text-ink hover:text-primary'}`}
                      >
                        {g.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-5">
                <h3 className="font-bold mb-3 text-primary-dark">المدرس</h3>
                <ul className="space-y-2 text-sm max-h-72 overflow-y-auto">
                  <li>
                    <Link
                      href="/books"
                      className={`block ${!filters.teacher_id ? 'text-primary font-bold' : 'text-ink hover:text-primary'}`}
                    >
                      الكل
                    </Link>
                  </li>
                  {teachers.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/books?teacher=${t.id}`}
                        className={`block ${filters.teacher_id === t.id ? 'text-primary font-bold' : 'text-ink hover:text-primary'}`}
                      >
                        {t.name_ar}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            {/* Books grid */}
            <div>
              {books.length === 0 ? (
                <div className="card p-12 text-center text-[#666]">
                  <i className="fa-regular fa-face-sad-tear text-4xl text-primary mb-4 block" />
                  لا توجد كتب بهذه المواصفات. جرّب تعديل الفلاتر.
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  {books.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      inStockBranches={availability.get(book.id)?.in_stock_branches ?? 0}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
