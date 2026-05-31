import {
  searchBooks,
  searchTeachers,
  getAvailabilitySummary,
  type AvailabilitySummary,
} from '@/lib/data';
import BookCard from '@/components/storefront/book-card';
import TeacherCard from '@/components/storefront/teacher-card';
import PageHeader from '@/components/storefront/page-header';
import SearchInput from '@/components/storefront/search-input';
import Link from 'next/link';

export const metadata = { title: 'البحث | مركز إنفينيتي' };

interface PageProps { searchParams: Promise<{ q?: string }> }

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const [books, teachersMatch] = query
    ? await Promise.all([searchBooks(query), searchTeachers(query)])
    : [[], []];
  const availability: Map<number, AvailabilitySummary> = query
    ? await getAvailabilitySummary(books.map((b) => b.id))
    : new Map();

  return (
    <>
      <PageHeader
        title={query ? `نتائج البحث عن: ${query}` : 'ابحث في المكتبة'}
        subtitle={
          query
            ? `${books.length} كتاب و ${teachersMatch.length} مدرس`
            : 'ابحث عن اسم كتاب أو مدرس'
        }
      />
      <section className="section">
        <div className="container-app">
          <div className="mb-10 max-w-2xl mx-auto">
            <SearchInput initialValue={query} autoFocus />
          </div>

          {/* Announce result counts to screen readers when the query changes.
              The visible count lives in the page header; this polite live
              region makes type-to-search results perceivable non-visually. */}
          <p role="status" aria-live="polite" className="sr-only">
            {query
              ? `نتائج البحث عن ${query}: ${books.length} كتاب و ${teachersMatch.length} مدرس`
              : ''}
          </p>

          {query && teachersMatch.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-extrabold text-primary-dark mb-4">المدرسين</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {teachersMatch.map((t) => <TeacherCard key={t.id} teacher={t} />)}
              </div>
            </div>
          )}

          {query && books.length > 0 && (
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

          {query && books.length === 0 && teachersMatch.length === 0 && (
            <div className="card p-10 sm:p-14 text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 rounded-full bg-primary-light text-primary-dark flex items-center justify-center mx-auto mb-5 text-3xl">
                <i className="fa-regular fa-circle-question" aria-hidden />
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
