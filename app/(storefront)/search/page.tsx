import { searchBooks, searchTeachers, getAvailabilitySummary } from '@/lib/data';
import BookCard from '@/components/storefront/book-card';
import TeacherCard from '@/components/storefront/teacher-card';
import PageHeader from '@/components/storefront/page-header';
import Link from 'next/link';

export const metadata = { title: 'البحث | مكتبة إنفينيتي' };

interface PageProps { searchParams: Promise<{ q?: string }> }

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  if (!query) {
    return (
      <>
        <PageHeader title="ابحث في المكتبة" subtitle="ابحث عن اسم كتاب أو مدرس" />
        <section className="section">
          <div className="container-app max-w-2xl">
            <form action="/search" method="get">
              <div className="flex gap-2">
                <input
                  name="q"
                  type="search"
                  placeholder="ابحث عن كتاب أو مدرس..."
                  className="flex-1 px-4 py-3 rounded-pill border border-[#ddd] focus:outline-none focus:border-primary font-body"
                  autoFocus
                />
                <button type="submit" className="btn btn-primary px-8">بحث</button>
              </div>
            </form>
          </div>
        </section>
      </>
    );
  }

  const [books, teachersMatch] = await Promise.all([
    searchBooks(query),
    searchTeachers(query),
  ]);
  const availability = await getAvailabilitySummary(books.map((b) => b.id));

  return (
    <>
      <PageHeader title={`نتائج البحث عن: ${query}`} subtitle={`${books.length} كتاب و ${teachersMatch.length} مدرس`} />
      <section className="section">
        <div className="container-app">
          <form action="/search" method="get" className="mb-10 max-w-2xl">
            <div className="flex gap-2">
              <input
                name="q"
                type="search"
                defaultValue={query}
                className="flex-1 px-4 py-3 rounded-pill border border-[#ddd] focus:outline-none focus:border-primary font-body"
              />
              <button type="submit" className="btn btn-primary px-8">بحث</button>
            </div>
          </form>

          {teachersMatch.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-extrabold text-primary-dark mb-4">المدرسين</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {teachersMatch.map((t) => <TeacherCard key={t.id} teacher={t} />)}
              </div>
            </div>
          )}

          {books.length > 0 && (
            <div>
              <h2 className="text-xl font-extrabold text-primary-dark mb-4">الكتب</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {books.map((b) => (
                  <BookCard key={b.id} book={b} inStockBranches={availability.get(b.id)?.in_stock_branches ?? 0} />
                ))}
              </div>
            </div>
          )}

          {books.length === 0 && teachersMatch.length === 0 && (
            <div className="card p-12 text-center">
              <i className="fa-regular fa-circle-question text-4xl text-primary mb-4 block" />
              <p className="text-[#666] mb-4">لم نجد نتائج لـ "<span className="font-bold">{query}</span>"</p>
              <Link href="/books" className="btn btn-outline">تصفح كل الكتب</Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
