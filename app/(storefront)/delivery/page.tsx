import { createClient } from '@/lib/supabase/server';
import { getSiteSettings } from '@/lib/data';
import PageHeader from '@/components/storefront/page-header';

export const metadata = { title: 'الشحن | مركز إنفينيتي' };

export default async function DeliveryPage() {
  const supa = await createClient();
  const { data: rates } = await supa
    .from('shipping_rates')
    .select('governorate_ar, area_type, price')
    .eq('is_active', true)
    .order('area_type');
  const settings = await getSiteSettings();
  const threshold = settings?.free_shipping_threshold ?? 2500;

  const areaLabels: Record<string, string> = {
    alexandria_city: 'الإسكندرية (داخل المدينة)',
    alexandria_outskirts: 'ضواحي الإسكندرية',
    kafr_el_dawwar: 'كفر الدوار',
    other_governorate: 'محافظات أخرى',
  };

  return (
    <>
      <PageHeader title="الشحن والتوصيل" subtitle="خيارات الاستلام والتوصيل لجميع المحافظات" />

      <section className="section">
        <div className="container-app max-w-3xl space-y-6">
          <div className="card bg-primary-light border-2 border-primary/30 p-6 text-center">
            <div className="text-5xl mb-3">🚚</div>
            <h2 className="text-2xl font-extrabold text-primary-dark mb-2">
              شحن مجاني فوق {threshold} جنيه
            </h2>
            <p className="text-primary-dark/80">
              اطلب بأكثر من {threshold} جنيه واحصل على التوصيل مجانًا إلى جميع المحافظات.
            </p>
          </div>

          <div className="card p-4 sm:p-6">
            <h3 className="font-bold text-primary-dark mb-4 text-lg">أسعار الشحن</h3>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-sm text-[#666] border-b border-bg-light">
                <tr>
                  <th className="text-right pb-3">المنطقة</th>
                  <th className="text-left pb-3">السعر</th>
                </tr>
              </thead>
              <tbody>
                {(rates ?? []).map((r: any) => (
                  <tr key={r.area_type} className="border-b border-bg-light last:border-0">
                    <td className="py-3">{areaLabels[r.area_type] ?? r.governorate_ar}</td>
                    <td className="py-3 text-left font-bold text-accent-dark">{r.price} جنيه</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3 text-[#666]">استلام من الفرع</td>
                  <td className="py-3 text-left font-bold text-success">مجاني</td>
                </tr>
              </tbody>
            </table>
            </div>
            <p className="text-xs text-[#666] mt-4">
              * أسعار المحافظات الأخرى قيد التحديث — سيتم عرضها عند اختيار العنوان وقت الطلب.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-primary-dark mb-4 text-lg">طرق الاستلام</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3">
                <i className="fa-solid fa-store text-primary text-xl w-6" />
                <div>
                  <div className="font-bold mb-1">الاستلام من الفرع</div>
                  <p className="text-[#666]">
                    اختر أقرب فرع عند الطلب، هنحجز لك الكتب لمدة ٢٤ ساعة ثم تحضر لاستلامها. مجاني بالكامل.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <i className="fa-solid fa-truck-fast text-primary text-xl w-6" />
                <div>
                  <div className="font-bold mb-1">التوصيل لباب البيت</div>
                  <p className="text-[#666]">
                    نوصلك عبر شركة شحن معتمدة خلال ٢-٥ أيام حسب المحافظة. الشحن مجاني فوق {threshold} جنيه.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
