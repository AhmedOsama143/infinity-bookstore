import { getSiteSettings } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/storefront/page-header';
import CartView from '@/components/cart/cart-view';

export const metadata = { title: 'السلة | مركز إنفينيتي' };

export default async function CartPage() {
  const settings = await getSiteSettings();
  const threshold = Number(settings?.free_shipping_threshold ?? 2500);
  const cap = settings?.student_book_cap ?? 10;

  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  let alreadyOrdered = 0;
  let capOverride: number | null = null;
  if (user) {
    const { data } = await supa
      .from('students')
      .select('books_ordered_count, cap_override')
      .eq('id', user.id)
      .maybeSingle();
    alreadyOrdered = data?.books_ordered_count ?? 0;
    capOverride = data?.cap_override ?? null;
  }

  return (
    <>
      <PageHeader title="سلة المشتريات" />
      <section className="section">
        <div className="container-app">
          <CartView
            freeShippingThreshold={threshold}
            isSignedIn={!!user}
            alreadyOrdered={alreadyOrdered}
            cap={capOverride ?? cap}
          />
        </div>
      </section>
    </>
  );
}
