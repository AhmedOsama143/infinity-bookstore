import { getBranches } from '@/lib/data';
import PageHeader from '@/components/storefront/page-header';

export const metadata = { title: 'فروعنا | مكتبة إنفينيتي' };

export default async function BranchesPage() {
  const branches = await getBranches();
  return (
    <>
      <PageHeader title="فروعنا" subtitle="٣ فروع لخدمتك في كفر الدوار والإسكندرية" />
      <section className="section">
        <div className="container-app grid md:grid-cols-3 gap-6">
          {branches.map((b) => (
            <div key={b.slug} id={b.slug} className="card p-6 scroll-mt-24">
              <div className="w-14 h-14 rounded-full bg-primary-light text-primary-dark flex items-center justify-center mb-4 text-xl">
                <i className="fa-solid fa-location-dot" />
              </div>
              <h2 className="text-xl font-bold mb-2">{b.name_ar}</h2>
              <p className="text-sm text-[#666] mb-4 leading-loose">{b.address_ar}</p>
              <div className="text-sm space-y-2 mb-5">
                <a href={`tel:${b.phone}`} className="flex items-center gap-2 hover:text-primary">
                  <i className="fa-solid fa-phone text-primary" />
                  {b.phone}
                </a>
                <a
                  href={`https://wa.me/${b.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-primary"
                >
                  <i className="fa-brands fa-whatsapp text-[#25D366]" />
                  واتساب
                </a>
              </div>
              {b.latitude && b.longitude && (
                <a
                  href={`https://maps.google.com/?q=${b.latitude},${b.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary w-full text-center text-sm"
                >
                  <i className="fa-solid fa-location-dot ml-2" />
                  افتح على الخريطة
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
