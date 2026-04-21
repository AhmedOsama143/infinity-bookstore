import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      {/* Free-shipping announcement bar — §3.2 */}
      <div className="bg-primary-dark text-white text-center text-sm py-2 font-body">
        🚚 شحن مجاني لكل طلب أكثر من ٢٥٠٠ جنيه — على جميع المحافظات!
      </div>

      {/* Header */}
      <header className="sticky top-0 bg-white z-50 h-[70px] flex items-center shadow-card">
        <div className="container-app flex items-center justify-between w-full">
          <Link href="/" className="text-[1.4rem] font-extrabold text-primary-dark font-heading">
            مكتبة <span className="text-accent font-bold">إنفينيتي</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-primary font-medium text-[.95rem] relative">
              الرئيسية
              <span className="absolute -bottom-1 right-0 w-full h-0.5 bg-primary"></span>
            </Link>
            <Link href="/books" className="text-ink hover:text-primary transition-colors text-[.95rem]">الكتب</Link>
            <Link href="/teachers" className="text-ink hover:text-primary transition-colors text-[.95rem]">المدرسين</Link>
            <Link href="/grade-level" className="text-ink hover:text-primary transition-colors text-[.95rem]">الصفوف</Link>
            <Link href="/delivery" className="text-ink hover:text-primary transition-colors text-[.95rem]">الشحن</Link>
            <Link href="/about" className="text-ink hover:text-primary transition-colors text-[.95rem]">من نحن</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn btn-outline text-sm">دخول</Link>
            <Link href="/register" className="btn btn-primary text-sm">تسجيل</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero-gradient text-white py-24 text-center relative overflow-hidden">
        <div className="container-app relative z-10">
          <div className="inline-block bg-white/20 text-white px-4 py-1.5 rounded-pill text-sm font-semibold mb-6 backdrop-blur">
            🚚 اطلب بـ ٢٥٠٠ جنيه واحصل على شحن مجاني
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            مكتبة إنفينيتي — كتبك في كل فرع
          </h1>
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            أفضل كتب المدرسين للمرحلة الثانوية. استلم من أقرب فرع أو اطلب للتوصيل لبابك.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/books" className="btn bg-white text-primary-dark hover:bg-accent hover:text-white px-10 py-3.5 text-lg">
              تصفح الكتب
            </Link>
            <Link href="/teachers" className="btn btn-outline border-white text-white hover:bg-white hover:text-primary-dark px-10 py-3.5 text-lg">
              تعرف على المدرسين
            </Link>
          </div>
        </div>
      </section>

      {/* Branches preview — §2 */}
      <section className="section bg-bg-light">
        <div className="container-app">
          <h2 className="section-title">فروعنا</h2>
          <p className="section-subtitle">٣ فروع في كفر الدوار والإسكندرية — استلم طلبك من أقرب فرع</p>
          <div className="grid md:grid-cols-3 gap-6">
            {branches.map((b) => (
              <div key={b.slug} className="card card-hover p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-primary-light text-primary-dark flex items-center justify-center mx-auto mb-4 text-2xl">
                  <i className="fa-solid fa-location-dot"></i>
                </div>
                <h3 className="text-lg font-bold mb-2">{b.name_ar}</h3>
                <p className="text-[#666] text-sm mb-4 leading-loose">{b.address_ar}</p>
                <a
                  href={`https://wa.me/${b.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary text-sm"
                >
                  <i className="fa-brands fa-whatsapp ml-2"></i>
                  تواصل مع الفرع
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free-shipping promo card */}
      <section className="section">
        <div className="container-app">
          <div className="bg-page-header rounded-card p-12 text-center text-white">
            <div className="text-5xl mb-4">🚚</div>
            <h2 className="text-3xl font-extrabold mb-3">شحن مجاني على الطلبات فوق ٢٥٠٠ جنيه</h2>
            <p className="text-lg opacity-90 mb-6 max-w-2xl mx-auto">
              اشتر أكثر ووفر على الشحن. نوصلك لأي محافظة في مصر مجانًا عند وصول طلبك للحد الأدنى.
            </p>
            <Link href="/books" className="btn bg-white text-primary-dark hover:bg-accent hover:text-white px-10 py-3.5">
              تسوق الآن
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary-dark text-white pt-16 pb-6">
        <div className="container-app">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="text-xl font-extrabold mb-4">
                مكتبة <span className="text-accent">إنفينيتي</span>
              </div>
              <p className="text-white/70 text-sm leading-loose">
                مكتبة متخصصة في كتب المدرسين للمرحلة الثانوية.
              </p>
              <p className="text-accent text-sm mt-4 font-bold">
                🚚 شحن مجاني للطلبات فوق ٢٥٠٠ جنيه
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-accent">روابط</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link href="/books" className="hover:text-white">الكتب</Link></li>
                <li><Link href="/teachers" className="hover:text-white">المدرسين</Link></li>
                <li><Link href="/delivery" className="hover:text-white">الشحن</Link></li>
                <li><Link href="/about" className="hover:text-white">من نحن</Link></li>
                <li><Link href="/faq" className="hover:text-white">الأسئلة الشائعة</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-accent">فروعنا</h4>
              <ul className="space-y-2 text-sm text-white/70">
                {branches.map((b) => (
                  <li key={b.slug}>{b.name_ar} — {b.city}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-accent">تواصل معنا</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  <a href="tel:01104605272" className="hover:text-white">
                    <i className="fa-solid fa-phone ml-2"></i>01104605272
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/201104605272" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    <i className="fa-brands fa-whatsapp ml-2"></i>واتساب الدعم
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-white/60 text-sm">
            © {new Date().getFullYear()} مكتبة إنفينيتي — جميع الحقوق محفوظة
          </div>
        </div>
      </footer>
    </>
  );
}

// Static branch data — will be replaced with Supabase queries in Phase 2.
const branches = [
  {
    slug: 'tamlik',
    name_ar: 'فرع التمليك',
    city: 'كفر الدوار',
    address_ar: 'البحيرة — كفر الدوار — التمليك — أمام مسجد الهدي',
    whatsapp: '201203417049',
  },
  {
    slug: 'elgeish',
    name_ar: 'فرع شارع الجيش',
    city: 'كفر الدوار',
    address_ar: 'البحيرة — كفر الدوار — شارع الجيش — خلف بنك مصر، أمام مول الأصدقاء',
    whatsapp: '201558656542',
  },
  {
    slug: 'escott',
    name_ar: 'فرع إسكوت',
    city: 'الإسكندرية',
    address_ar: 'الإسكندرية — سيدي بشر بحري — شارع 17 — فوق النفق (منطقة إسكوت)',
    whatsapp: '201553950043',
  },
];
