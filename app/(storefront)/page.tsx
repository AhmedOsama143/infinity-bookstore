import Link from 'next/link';
import { getBooks, getBranches, getTeachers, getAvailabilitySummary, getSiteSettings } from '@/lib/data';
import BookCard from '@/components/storefront/book-card';
import TeacherCard from '@/components/storefront/teacher-card';

export default async function HomePage() {
  const [featuredBooks, featuredTeachers, branches, settings] = await Promise.all([
    getBooks({ limit: 8 }),
    getTeachers(),
    getBranches(),
    getSiteSettings(),
  ]);
  const availability = await getAvailabilitySummary(featuredBooks.map((b) => b.id));
  const threshold = settings?.free_shipping_threshold ?? 2500;

  return (
    <>
      {/* Hero */}
      <section className="bg-hero-gradient text-white py-14 sm:py-20 md:py-24 text-center relative overflow-hidden">
        <div className="container-app relative z-10">
          <div className="inline-block bg-white/20 text-white px-3 sm:px-4 py-1.5 rounded-pill text-xs sm:text-sm font-semibold mb-4 sm:mb-6 backdrop-blur">
            🚚 اطلب بـ {threshold} جنيه واحصل على شحن مجاني
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-3 sm:mb-4 leading-tight">
            مركز إنفينيتي — كتبك في كل فرع
          </h1>
          <p className="text-sm sm:text-lg md:text-xl opacity-90 mb-6 sm:mb-8 max-w-2xl mx-auto">
            أفضل كتب المدرسين للمرحلة الثانوية. استلم من أقرب فرع أو اطلب للتوصيل لبابك.
          </p>
          <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
            <Link href="/books" className="btn bg-white text-primary-dark hover:bg-accent hover:text-white px-6 sm:px-10 py-2.5 sm:py-3.5 text-sm sm:text-lg">
              تصفح الكتب
            </Link>
            <Link href="/teachers" className="btn btn-outline border-white text-white hover:bg-white hover:text-primary-dark px-6 sm:px-10 py-2.5 sm:py-3.5 text-sm sm:text-lg">
              تعرف على المدرسين
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip — sits directly under the hero so customers register the
          baseline reassurances (real branches, free shipping, WhatsApp, COD)
          before they ever scroll into a product. RTL-aware grid: 2 cols on
          mobile, 4 on tablet+. */}
      <section className="py-6 sm:py-8 bg-bg-white border-b border-bg-light">
        <div className="container-app">
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <li className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-light text-primary-dark flex items-center justify-center flex-shrink-0 text-base sm:text-lg">
                <i className="fa-solid fa-store" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm sm:text-base leading-tight">٣ فروع حقيقية</p>
                <p className="text-xs text-[#666] leading-tight mt-0.5">كفر الدوار والإسكندرية</p>
              </div>
            </li>
            <li className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent/15 text-accent-dark flex items-center justify-center flex-shrink-0 text-base sm:text-lg">
                <i className="fa-solid fa-truck-fast" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm sm:text-base leading-tight">شحن مجاني</p>
                <p className="text-xs text-[#666] leading-tight mt-0.5">للطلبات فوق {threshold} جنيه</p>
              </div>
            </li>
            <li className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-success/10 text-success flex items-center justify-center flex-shrink-0 text-base sm:text-lg">
                <i className="fa-solid fa-money-bill-wave" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm sm:text-base leading-tight">ادفع عند الاستلام</p>
                <p className="text-xs text-[#666] leading-tight mt-0.5">كاش بدون أي رسوم</p>
              </div>
            </li>
            <li className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center flex-shrink-0 text-base sm:text-lg">
                <i className="fa-brands fa-whatsapp" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm sm:text-base leading-tight">دعم واتساب</p>
                <p className="text-xs text-[#666] leading-tight mt-0.5">طوال أيام الأسبوع</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* Featured books */}
      <section className="section">
        <div className="container-app">
          <h2 className="section-title">أحدث الكتب</h2>
          <p className="section-subtitle">اختر من أفضل كتب المدرسين لكل الصفوف</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {featuredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                inStockBranches={availability.get(book.id)?.in_stock_branches ?? 0}
                minQty={availability.get(book.id)?.min_qty}
                minQtyBranchName={availability.get(book.id)?.min_qty_branch_name}
              />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/books" className="btn btn-outline">عرض كل الكتب</Link>
          </div>
        </div>
      </section>

      {/* Featured teachers */}
      <section className="section bg-bg-light">
        <div className="container-app">
          <h2 className="section-title">المدرسين</h2>
          <p className="section-subtitle">نخبة من أفضل مدرسي الثانوية العامة</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredTeachers.slice(0, 8).map((t) => (
              <TeacherCard key={t.id} teacher={t} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/teachers" className="btn btn-outline">عرض كل المدرسين</Link>
          </div>
        </div>
      </section>

      {/* Branches */}
      <section className="section">
        <div className="container-app">
          <h2 className="section-title">فروعنا</h2>
          <p className="section-subtitle">٣ فروع في كفر الدوار والإسكندرية — استلم طلبك من أقرب فرع</p>
          <div className="grid md:grid-cols-3 gap-6">
            {branches.map((b) => (
              <div key={b.slug} className="card card-hover p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-primary-light text-primary-dark flex items-center justify-center mx-auto mb-4 text-2xl">
                  <i className="fa-solid fa-location-dot" />
                </div>
                <h3 className="text-lg font-bold mb-2">{b.name_ar}</h3>
                <p className="text-[#666] text-sm mb-4 leading-loose">{b.address_ar}</p>
                <div className="flex gap-2 justify-center">
                  <a
                    href={`https://wa.me/${b.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary text-sm"
                  >
                    <i className="fa-brands fa-whatsapp ml-2" />
                    واتساب
                  </a>
                  {b.latitude && b.longitude && (
                    <a
                      href={`https://maps.google.com/?q=${b.latitude},${b.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline text-sm"
                    >
                      <i className="fa-solid fa-location-dot ml-2" />
                      الخريطة
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free-shipping promo */}
      <section className="section">
        <div className="container-app">
          <div className="bg-page-header rounded-card p-6 sm:p-10 md:p-12 text-center text-white">
            <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🚚</div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-2 sm:mb-3">
              شحن مجاني على الطلبات فوق {threshold} جنيه
            </h2>
            <p className="text-sm sm:text-lg opacity-90 mb-4 sm:mb-6 max-w-2xl mx-auto">
              اشتر أكثر ووفر على الشحن. نوصلك لأي محافظة في مصر مجانًا عند وصول طلبك للحد الأدنى.
            </p>
            <Link href="/books" className="btn bg-white text-primary-dark hover:bg-accent hover:text-white px-8 sm:px-10 py-2.5 sm:py-3.5 text-sm sm:text-base">
              تسوق الآن
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
