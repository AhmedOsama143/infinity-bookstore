import type { Metadata } from 'next';
import { Cairo, Tajawal } from 'next/font/google';
import './globals.css';
import { GtmHead, GtmBody } from '@/components/analytics/gtm-loader';
import WebVitalsReporter from '@/components/analytics/web-vitals';

// Self-hosted Arabic-subset fonts. Cuts ~1-2s off LCP on 3G compared to the
// previous Google Fonts CDN <link> approach because (a) only Arabic glyphs are
// shipped, (b) the font CSS is inlined at build time, and (c) Next.js emits a
// rel=preload for the woff2.
const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-cairo',
});

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-tajawal',
});

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
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <GtmHead />
      </head>
      <body>
        <GtmBody />
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
