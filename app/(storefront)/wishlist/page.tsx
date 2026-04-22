import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BookCard from '@/components/storefront/book-card';
import PageHeader from '@/components/storefront/page-header';
import AccountNav from '@/components/storefront/account-nav';
import { getAvailabilitySummary } from '@/lib/data';
import type { BookWithTeacher } from '@/lib/types';

export const metadata = { title: 'المفضلة | مكتبة إنفينيتي' };

export default async function WishlistPage() {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login?next=/wishlist');

  const { data } = await supa
    .from('wishlists')
    .select(
      'created_at, book:books(id, title_ar, teacher_id, grade_level, book_type, description, cover_url, price, discount_pct, final_price, weight_grams, publish_year, isbn, is_active, needs_review, teacher:teachers(id, name_ar, photo_url))'
    )
    .eq('student_id', user.id)
    .order('created_at', { ascending: false });

  const books = ((data ?? []).map((r: any) => r.book).filter(Boolean)) as BookWithTeacher[];
  const availability = await getAvailabilitySummary(books.map((b) => b.id));

  return (
    <>
      <PageHeader title="حسابي" />
      <section className="section">
        <div className="container-app grid md:grid-cols-[240px_1fr] gap-8">
          <aside><AccountNav /></aside>
          <div>
            {books.length === 0 ? (
              <div className="card p-12 text-center">
                <i className="fa-regular fa-heart text-5xl text-primary-light mb-4 block" />
                <h2 className="text-xl font-bold mb-2">قائمة المفضلة فارغة</h2>
                <p className="text-[#666] mb-6">احفظ كتبك المفضلة هنا للرجوع إليها لاحقًا</p>
                <Link href="/books" className="btn btn-primary">تصفح الكتب</Link>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-primary-dark mb-5">
                  {books.length} {books.length === 1 ? 'كتاب' : 'كتب'} في المفضلة
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  {books.map((b) => (
                    <BookCard
                      key={b.id}
                      book={b}
                      inStockBranches={availability.get(b.id)?.in_stock_branches ?? 0}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
