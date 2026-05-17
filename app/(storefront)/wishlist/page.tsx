import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BookCard from '@/components/storefront/book-card';
import PageHeader from '@/components/storefront/page-header';
import AccountNav from '@/components/storefront/account-nav';
import { getAvailabilitySummary } from '@/lib/data';
import type { BookWithTeacher } from '@/lib/types';

export const metadata = { title: 'المفضلة | مركز إنفينيتي' };

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
        <div className="container-app grid md:grid-cols-[220px_1fr] gap-5 md:gap-8">
          <aside><AccountNav /></aside>
          <div>
            {books.length === 0 ? (
              <div className="card p-10 sm:p-14 text-center">
                <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-5 text-3xl text-primary-dark">
                  <i className="fa-regular fa-heart" />
                </div>
                <h2 className="text-xl font-extrabold text-primary-dark mb-2">قائمة المفضلة فاضية</h2>
                <p className="text-[#666] mb-6 leading-loose">
                  احفظ كتبك اللي عجبتك هنا واطلبها لما تكون جاهز.<br className="hidden sm:inline" />
                  انضغط على القلب جنب أي كتاب لإضافته.
                </p>
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
                      minQty={availability.get(b.id)?.min_qty}
                      minQtyBranchName={availability.get(b.id)?.min_qty_branch_name}
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
