import Link from 'next/link';
import { getBooks, getAvailabilitySummary } from '@/lib/data';
import { gradeLabelAr } from '@/lib/utils';
import type { GradeLevel } from '@/lib/types';
import BookCard from '@/components/storefront/book-card';
import PageHeader from '@/components/storefront/page-header';

export const metadata = { title: 'الصفوف الدراسية | مركز إنفينيتي' };

const GRADES: GradeLevel[] = ['first_secondary', 'second_secondary', 'third_secondary'];

export default async function GradeLevelPage() {
  const [all] = await Promise.all([getBooks({})]);
  const availability = await getAvailabilitySummary(all.map((b) => b.id));
  const byGrade = new Map<GradeLevel, typeof all>();
  for (const g of GRADES) byGrade.set(g, []);
  for (const b of all) byGrade.get(b.grade_level)!.push(b);

  return (
    <>
      <PageHeader title="الصفوف الدراسية" subtitle="كتب مقسّمة حسب الصف" />
      <section className="section">
        <div className="container-app space-y-16">
          {GRADES.map((g) => {
            const books = byGrade.get(g) ?? [];
            if (books.length === 0) return null;
            return (
              <div key={g}>
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2 mb-6">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-primary-dark">{gradeLabelAr[g]}</h2>
                  <Link href={`/books?grade=${g}`} className="btn btn-outline text-sm shrink-0">
                    عرض الكل ({books.length})
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {books.slice(0, 4).map((b) => (
                    <BookCard
                      key={b.id}
                      book={b}
                      inStockBranches={availability.get(b.id)?.in_stock_branches ?? 0}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
