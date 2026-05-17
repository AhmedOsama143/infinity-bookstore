// Dynamic OG image for each book. Generated on-demand by Vercel's Edge
// Functions and cached at the CDN — a WhatsApp / Facebook / Twitter share
// turns into a branded product card with the title, teacher, and price.
//
// Without a custom Arabic font ImageResponse won't render the title — the
// runtime ships only Latin glyphs. We pull a Cairo woff2 from Google Fonts
// once per cold start (Edge function instance) and pass it via the `fonts`
// option.

import { ImageResponse } from 'next/og';
import { getBook } from '@/lib/data';
import { formatPrice } from '@/lib/utils';

export const runtime = 'edge';
export const alt = 'مركز إنفينيتي';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function loadCairoBold(): Promise<ArrayBuffer> {
  const cssUrl =
    'https://fonts.googleapis.com/css2?family=Cairo:wght@800&display=swap&subset=arabic';
  const css = await fetch(cssUrl, {
    headers: {
      // Google serves woff2 to evergreen UAs only.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    },
  }).then((r) => r.text());
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:woff2|opentype|truetype)'\)/);
  if (!match) throw new Error('cairo woff2 url not found in google css');
  const woff = await fetch(match[1]).then((r) => r.arrayBuffer());
  return woff;
}

export default async function OpengraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  const book = Number.isFinite(bookId) ? await getBook(bookId) : null;

  const title = book?.title_ar ?? 'مركز إنفينيتي';
  const teacher = book?.teacher?.name_ar ?? 'كتب المدرسين للمرحلة الثانوية';
  const price = book ? formatPrice(book.final_price) : null;

  const cairo = await loadCairoBold();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #3c655a 0%, #578e7e 50%, #e3af64 100%)',
          color: 'white',
          fontFamily: 'Cairo',
          padding: '60px 80px',
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 60,
            fontSize: 28,
            opacity: 0.9,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          📚 مركز إنفينيتي
        </div>

        <div
          style={{
            fontSize: title.length > 30 ? 64 : 80,
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: 30,
            maxWidth: 1000,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 36,
            opacity: 0.92,
            marginBottom: 40,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {teacher}
        </div>

        {price && (
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              background: '#e3af64',
              color: '#161618',
              padding: '14px 40px',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {price}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 36,
            fontSize: 24,
            opacity: 0.8,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          ٣ فروع · شحن مجاني فوق ٢٥٠٠ جنيه · ادفع عند الاستلام
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Cairo', data: cairo, style: 'normal', weight: 800 }],
    },
  );
}
