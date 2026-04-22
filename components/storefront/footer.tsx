import Link from 'next/link';
import { getBranches, getSiteSettings } from '@/lib/data';

export default async function Footer() {
  const [branches, settings] = await Promise.all([getBranches(), getSiteSettings()]);
  const threshold = settings?.free_shipping_threshold ?? 2500;
  const supportPhone = settings?.support_phone ?? '01104605272';
  const supportWa = settings?.support_whatsapp ?? '201104605272';

  return (
    <footer className="bg-primary-dark text-white pt-16 pb-6 mt-20">
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
              🚚 شحن مجاني للطلبات فوق {threshold} جنيه
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
                <li key={b.slug}>
                  <Link href={`/branches#${b.slug}`} className="hover:text-white">
                    {b.name_ar} — {b.city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-accent">تواصل معنا</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <a href={`tel:${supportPhone}`} className="hover:text-white">
                  <i className="fa-solid fa-phone ml-2" />
                  {supportPhone}
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${supportWa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  <i className="fa-brands fa-whatsapp ml-2" />
                  واتساب الدعم
                </a>
              </li>
              <li className="pt-2 border-t border-white/10 mt-3">
                <h5 className="text-accent text-xs mb-2">قانوني</h5>
                <Link href="/legal/privacy" className="hover:text-white block">سياسة الخصوصية</Link>
                <Link href="/legal/terms" className="hover:text-white block">شروط الاستخدام</Link>
                <Link href="/legal/refund" className="hover:text-white block">سياسة الاسترجاع</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 text-center text-white/60 text-sm">
          © {new Date().getFullYear()} مكتبة إنفينيتي — جميع الحقوق محفوظة
        </div>
      </div>
    </footer>
  );
}
