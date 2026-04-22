import AnnouncementBar from '@/components/storefront/announcement-bar';
import Header from '@/components/storefront/header';
import Footer from '@/components/storefront/footer';
import WhatsappFab from '@/components/storefront/whatsapp-fab';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main>{children}</main>
      <Footer />
      <WhatsappFab />
    </>
  );
}
