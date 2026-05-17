import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AnnouncementBar from '@/components/storefront/announcement-bar';
import Header from '@/components/storefront/header';
import Footer from '@/components/storefront/footer';
import WhatsappFab from '@/components/storefront/whatsapp-fab';
import SiteAmbient from '@/components/storefront/site-ambient';
import { CartProvider } from '@/components/cart/cart-provider';
import MiniCart from '@/components/cart/mini-cart';
import { createClient } from '@/lib/supabase/server';
import { getSiteSettings } from '@/lib/data';

const ONBOARDING_EXEMPT_PREFIXES = ['/onboarding', '/legal'];

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  // Onboarding gate: a logged-in student with no grade_level is redirected
  // to /onboarding the first time they hit any storefront page.
  const supa = await createClient();
  const [{ data: { user } }, settings] = await Promise.all([
    supa.auth.getUser(),
    getSiteSettings(),
  ]);
  const freeShippingThreshold = settings?.free_shipping_threshold ?? 2500;
  if (user) {
    const h = await headers();
    const path = h.get('x-pathname') ?? h.get('next-url') ?? '';
    const exempt = ONBOARDING_EXEMPT_PREFIXES.some((p) => path.startsWith(p));
    if (!exempt) {
      const { data: student } = await supa
        .from('students')
        .select('grade_level')
        .eq('id', user.id)
        .maybeSingle();
      if (student && !student.grade_level) {
        const next = path && path !== '/' ? `?next=${encodeURIComponent(path)}` : '';
        redirect(`/onboarding${next}`);
      }
    }
  }

  return (
    <CartProvider>
      <SiteAmbient />
      <AnnouncementBar />
      <Header />
      <main>{children}</main>
      <Footer />
      <WhatsappFab />
      <MiniCart freeShippingThreshold={freeShippingThreshold} />
    </CartProvider>
  );
}
