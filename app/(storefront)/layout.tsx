import AnnouncementBar from '@/components/storefront/announcement-bar';
import Header from '@/components/storefront/header';
import Footer from '@/components/storefront/footer';
import WhatsappFab from '@/components/storefront/whatsapp-fab';
import { CartProvider } from '@/components/cart/cart-provider';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <AnnouncementBar />
      <Header />
      <main>{children}</main>
      <Footer />
      <WhatsappFab />
    </CartProvider>
  );
}
