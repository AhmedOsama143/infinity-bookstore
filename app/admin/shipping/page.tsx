import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import ShippingEditor from '@/components/admin/shipping-editor';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function ShippingSettingsPage() {
  await requireFullAdmin();
  const supa = await createClient();

  const [{ data: rates }, { data: settings }] = await Promise.all([
    supa.from('shipping_rates').select('id, area_type, governorate_ar, price').order('area_type'),
    supa.from('site_settings').select('free_shipping_threshold, free_shipping_enabled').eq('id', 1).maybeSingle(),
  ]);

  return (
    <PageShell title="الشحن والتوصيل" subtitle="إدارة أسعار الشحن والشحن المجاني">
      <div className="max-w-3xl">
        <ShippingEditor
          rates={(rates ?? []).map((r: any) => ({ ...r, price: Number(r.price) }))}
          threshold={Number(settings?.free_shipping_threshold ?? 2500)}
          enabled={settings?.free_shipping_enabled ?? true}
        />
      </div>
    </PageShell>
  );
}
