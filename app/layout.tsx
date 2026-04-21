import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'مكتبة إنفينيتي | Infinity Bookstore',
  description:
    'مكتبة إنفينيتي — كتب المدرسين للمرحلة الثانوية. فروعنا في كفر الدوار والإسكندرية. شحن مجاني على الطلبات فوق ٢٥٠٠ جنيه.',
  metadataBase: new URL('https://infinity-bookstore.vercel.app'),
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
      </head>
      <body>{children}</body>
    </html>
  );
}
