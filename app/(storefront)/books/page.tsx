import type { GradeLevel } from '@/lib/types';
import { getBooks, getAvailabilitySummary, getTeachers, type BookSort } from '@/lib/data';
import BookCard from '@/components/storefront/book-card';
import BooksFilterBar from '@/components/storefront/books-filter-bar';
import PageHeader from '@/components/storefront/page-header';

export const metadata = { title: 'الكتب | مركز إنفينيتي' };

interface PageProps {
  searchParams: Promise<{
    grade?: string;
    teacher?: string;
    search?: string;
    sort?: string;
  }>;
}

const VALID_SORTS: BookSort[] = ['newest', 'price_low', 'price_high'];

export default async function BooksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    grade: params.grade as GradeLevel | undefined,
    teacher_id: params.teacher ? parseInt(params.teacher, 10) : undefined,
    search: params.search || undefined,
    sort: VALID_SORTS.includes(params.sort as BookSort)
      ? (params.sort as BookSort)
      : undefined,
  };

  const [books, teachers] = await Promise.all([getBooks(filters), getTeachers()]);
  const availability = await getAvailabilitySummary(books.map((b) => b.id));

  return (
    <>
      <PageHeader title="جميع الكتب" subtitle="تصفح مجموعتنا الكاملة من الكتب التعليمية" />

      <section className="section">
        <div className="container-app">
          <BooksFilterBar
            teachers={teachers.map((t) => ({ id: t.id, name_ar: t.name_ar }))}
            grade={filters.grade}
            teacherId={filters.teacher_id}
            sort={filters.sort}
            search={filters.search}
          />

          <div className="mt-8">
            {books.length === 0 ? (
              <div className="card p-12 text-center text-[#666]">
                <i className="fa-regular fa-face-sad-tear text-4xl text-primary mb-4 block" />
                لا توجد كتب بهذه المواصفات. جرّب تعديل الفلاتر.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
      </section>
    </>
  );
}
