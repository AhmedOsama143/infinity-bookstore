import { searchBooks, searchTeachers, getAvailabilitySummary } from '@/lib/data';
import BookCard from '@/components/storefront/book-card';
import TeacherCard from '@/components/storefront/teacher-card';
import PageHeader from '@/components/storefront/page-header';
import Link from 'next/link';

export const metadata = { title: 'البحث | مركز إنفينيتي' };

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
                  <BookCard
                    key={b.id}
                    book={b}
                    inStockBranches={availability.get(b.id)?.in_stock_branches ?? 0}
                    minQty={availability.get(b.id)?.min_qty}
                    minQtyBranchName={availability.get(b.id)?.min_qty_branch_name}
                  />
                ))}
              </div>
            </div>
          )}

          {books.length === 0 && teachersMatch.length === 0 && (
            <div className="card p-10 sm:p-14 text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 rounded-full bg-primary-light text-primary-dark flex items-center justify-center mx-auto mb-5 text-3xl">
                <i className="fa-regular fa-circle-question" />
              </div>
              <h2 className="text-xl font-extrabold text-primary-dark mb-2">
                ما لقيناش نتائج لـ «{query}»
              </h2>
              <p className="text-[#666] mb-6 leading-loose">
                جرّب كلمة مختلفة، أو اسم المدرس بدل الكتاب — وأحيانًا الإملاء يفرق.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/books" className="btn btn-primary">
                  تصفح كل الكتب
                </Link>
                <Link href="/teachers" className="btn btn-outline">
                  اعرض المدرسين
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
