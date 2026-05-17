import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getBook, getBookStock, getRelatedBooks, getSiteSettings } from '@/lib/data';
import { bookTypeLabelAr, fallbackCover, formatPrice, gradeLabelAr } from '@/lib/utils';
import BookCard from '@/components/storefront/book-card';
import AddToCartButton from '@/components/cart/add-to-cart-button';
import BackInStockButton from '@/components/cart/back-in-stock-button';
import StickyMobileAtc from '@/components/cart/sticky-mobile-atc';
import ReviewsSection from '@/components/storefront/reviews-section';
import TrackViewItem from '@/components/analytics/track-view-item';

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const book = await getBook(parseInt(id, 10));
  if (!book) return { title: 'كتاب غير موجود' };
  const title = `${book.title_ar} | مركز إنفينيتي`;
  const description = book.description ?? `${book.title_ar} - ${book.teacher?.name_ar ?? ''}`.trim();
  const image = book.cover_url ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: image ? [{ url: image, width: 600, height: 800, alt: book.title_ar }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BookDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (!Number.isFinite(bookId)) notFound();

  const book = await getBook(bookId);
  if (!book) notFound();

  const [stock, related, settings] = await Promise.all([
    getBookStock(book.id),
    getRelatedBooks(book),
    getSiteSettings(),
  ]);

  const threshold = settings?.free_shipping_threshold ?? 2500;
  const cover = book.cover_url ?? fallbackCover(book.title_ar);
  const totalAvailable = stock.reduce((sum, s) => sum + s.available, 0);
  const inStockBranches = stock.filter((s) => s.available > 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title_ar,
    description: book.description ?? undefined,
    image: book.cover_url ?? undefined,
    isbn: book.isbn ?? undefined,
    inLanguage: 'ar',
    bookFormat: 'https://schema.org/Paperback',
    author: book.teacher
      ? { '@type': 'Person', name: book.teacher.name_ar }
      : undefined,
    offers: {
      '@type': 'Offer',
      price: book.final_price,
      priceCurrency: 'EGP',
      availability:
        totalAvailable > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <section className="section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TrackViewItem
        item={{
          book_id: book.id,
          title_ar: book.title_ar,
          final_price: book.final_price,
          teacher_name: book.teacher?.name_ar ?? null,
          grade_level: book.grade_level,
        }}
      />
      <div className="container-app">
        <nav className="text-sm text-[#666] mb-6">
          <Link href="/" className="hover:text-primary">الرئيسية</Link>
          <span className="mx-2">/</span>
          <Link href="/books" className="hover:text-primary">الكتب</Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{book.title_ar}</span>
        </nav>

        <div className="grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-6 md:gap-10">
          <div className="relative aspect-[3/4] rounded-card overflow-hidden shadow-card bg-bg-light">
            <Image
              src={cover}
              alt={book.title_ar}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 320px"
              unoptimized={cover.startsWith('data:')}
            />
          </div>

          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="bg-primary-light text-primary-dark px-3 py-1 rounded-pill text-xs font-semibold">
                {gradeLabelAr[book.grade_level]}
              </span>
              <span className="bg-bg-light text-ink px-3 py-1 rounded-pill text-xs font-semibold">
                {bookTypeLabelAr[book.book_type]}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold mb-3">{book.title_ar}</h1>
            {book.teacher && (
              <Link
                href={`/teachers/${book.teacher.id}`}
                className="inline-flex items-center gap-2 text-primary hover:text-primary-dark mb-6"
              >
                <i className="fa-solid fa-user" />
                {book.teacher.name_ar}
              </Link>
            )}

            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-2xl sm:text-4xl font-extrabold text-accent-dark">
                {formatPrice(book.final_price)}
              </span>
              {book.discount_pct > 0 && (
                <>
                  <span className="text-xl text-[#999] line-through">{formatPrice(book.price)}</span>
                  <span className="bg-accent text-white px-3 py-1 rounded-pill text-sm font-bold">
                    خصم {book.discount_pct}%
                  </span>
                </>
              )}
            </div>

            <div className="card bg-primary-light border border-primary/20 p-4 mb-6">
              <p className="text-primary-dark font-semibold">
                🚚 اطلب بـ {threshold} جنيه وأكثر واحصل على شحن مجاني
              </p>
            </div>

            {/* Availability per branch */}
            <div className="card p-5 mb-6">
              <h3 className="font-bold mb-3 text-primary-dark">
                <i className="fa-solid fa-boxes-stacked ml-2" />
                التوفر في الفروع
              </h3>
              {stock.length === 0 ? (
                <p className="text-sm text-[#666]">لا توجد بيانات مخزون حاليًا.</p>
              ) : (
                <ul className="space-y-3">
                  {stock.map((s) => (
                    <li
                      key={s.branch_id}
                      className="flex items-center justify-between border-b border-bg-light pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="font-bold">{s.branch_name_ar}</div>
                        <div className="text-xs text-[#666]">
                          {s.available > 0 ? '✅ متوفر' : '❌ غير متوفر'}
                        </div>
                      </div>
                      {s.available > 0 && (
                        <a
                          href={`https://wa.me/${s.branch_whatsapp}?text=${encodeURIComponent(`مرحباً، أريد الاستفسار عن كتاب "${book.title_ar}" المتوفر في ${s.branch_name_ar}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline text-xs"
                        >
                          <i className="fa-brands fa-whatsapp ml-1" />
                          استفسار
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div id="pdp-primary-atc" className="flex flex-wrap gap-3">
              <AddToCartButton
                item={{
                  book_id: book.id,
                  title_ar: book.title_ar,
                  cover_url: book.cover_url,
                  unit_price: book.final_price,
                  teacher_name: book.teacher?.name_ar,
                }}
                disabled={totalAvailable === 0}
                disabledReason={totalAvailable === 0 ? 'نفدت الكمية' : undefined}
                touchpoint="pdp_primary"
              />
              {totalAvailable === 0 && <BackInStockButton bookId={book.id} />}
            </div>

            {book.description && (
              <div className="mt-8">
                <h3 className="font-bold mb-2 text-primary-dark">الوصف</h3>
                <p className="text-ink/80 leading-loose whitespace-pre-wrap">{book.description}</p>
              </div>
            )}

            {(book.weight_grams || book.publish_year) && (
              <div className="mt-6 text-sm text-[#666] space-y-1">
                {book.weight_grams && <p>الوزن: {book.weight_grams} جرام</p>}
                {book.publish_year && <p>سنة النشر: {book.publish_year}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Reviews */}
        <ReviewsSection bookId={book.id} />

        {totalAvailable > 0 && (
          <StickyMobileAtc
            item={{
              book_id: book.id,
              title_ar: book.title_ar,
              cover_url: book.cover_url,
              unit_price: book.final_price,
              teacher_name: book.teacher?.name_ar,
            }}
            finalPrice={book.final_price}
            originalPrice={book.discount_pct > 0 ? book.price : null}
            sentinelId="pdp-primary-atc"
          />
        )}

        {/* Related books */}
        {related.length > 0 && (
          <div className="mt-20">
            <h2 className="section-title">كتب مشابهة</h2>
            <p className="section-subtitle">
              {book.teacher ? `كتب أخرى لـ ${book.teacher.name_ar} أو في نفس الصف` : `كتب أخرى في ${gradeLabelAr[book.grade_level]}`}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {related.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
