import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'مركز إنفينيتي | Infinity Center',
  description:
    'مركز إنفينيتي — كتب المدرسين للمرحلة الثانوية. فروعنا في كفر الدوار والإسكندرية. شحن مجاني على الطلبات فوق ٢٥٠٠ جنيه.',
  metadataBase: new URL('https://infinity-bookstore.vercel.app'),
  openGraph: {
    title: 'مركز إنفينيتي | Infinity Center',
    description:
      'كتب المدرسين للمرحلة الثانوية في فروعنا بكفر الدوار والإسكندرية. شحن مجاني للطلبات فوق ٢٥٠٠ جنيه.',
    siteName: 'مركز إنفينيتي',
    type: 'website',
    locale: 'ar_EG',
  },
  twitter: { card: 'summary_large_image' },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'BookStore',
  name: 'مركز إنفينيتي',
  alternateName: 'Infinity Center',
  url: 'https://infinity-bookstore.vercel.app',
  telephone: '+201104605272',
  areaServed: 'EG',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'EG',
    addressRegion: 'البحيرة، الإسكندرية',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
