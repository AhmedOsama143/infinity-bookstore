import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBranches, getSiteSettings } from '@/lib/data';
import PageHeader from '@/components/storefront/page-header';
import CheckoutView from '@/components/cart/checkout-view';
import type { ShippingAreaType } from '@/lib/types';

export const metadata = { title: 'إتمام الطلب | مركز إنفينيتي' };

export default async function CheckoutPage() {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login?next=/checkout');

  const [{ data: student }, branches, settings, { data: rates }] = await Promise.all([
    supa
      .from('students')
      .select('full_name, phone, governorate, address, books_ordered_count, cap_override')
      .eq('id', user.id)
      .maybeSingle(),
    getBranches(),
    getSiteSettings(),
    supa.from('shipping_rates').select('area_type, price').eq('is_active', true),
  ]);

  const rateMap: Record<string, number> = {};
  for (const r of rates ?? []) rateMap[r.area_type] = Number(r.price);

  return (
    <>
      <PageHeader title="إتمام الطلب" />
      <section className="section">
        <div className="container-app">
          <CheckoutView
            branches={branches.map((b) => ({
              id: b.id,
              slug: b.slug,
              name_ar: b.name_ar,
              address_ar: b.address_ar,
              city: b.city,
            }))}
            shippingRates={rateMap as Record<ShippingAreaType, number>}
            freeShippingThreshold={Number(settings?.free_shipping_threshold ?? 2500)}
            freeShippingEnabled={settings?.free_shipping_enabled ?? true}
            cap={student?.cap_override ?? settings?.student_book_cap ?? 10}
            alreadyOrdered={student?.books_ordered_count ?? 0}
            student={{
              full_name: student?.full_name ?? '',
              phone: student?.phone ?? '',
              governorate: student?.governorate ?? '',
              address: student?.address ?? '',
            }}
          />
        </div>
      </section>
    </>
  );
}
