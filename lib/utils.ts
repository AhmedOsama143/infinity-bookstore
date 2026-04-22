import type { GradeLevel, BookType } from './types';

export const gradeLabelAr: Record<GradeLevel, string> = {
  first_secondary: 'الأول الثانوي',
  second_secondary: 'الثاني الثانوي',
  third_secondary: 'الثالث الثانوي',
};

export const bookTypeLabelAr: Record<BookType, string> = {
  external_ar: 'خارجي',
  online_ar: 'أونلاين',
};

export function formatPrice(egp: number): string {
  return `${egp.toFixed(0)} جنيه`;
}

export function formatPriceWithDecimals(egp: number): string {
  return `${egp.toFixed(2)} جنيه`;
}

export function whatsappLink(phoneDigitsOnly: string, prefill?: string): string {
  const base = `https://wa.me/${phoneDigitsOnly}`;
  return prefill ? `${base}?text=${encodeURIComponent(prefill)}` : base;
}

export function mapsLink(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

// Fallback cover for books without an uploaded image.
// Uses a data-URL SVG with title + brand gradient — no external request.
export function fallbackCover(title: string): string {
  const safe = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 40);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 420'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#3c655a'/>
      <stop offset='100%' stop-color='#578e7e'/>
    </linearGradient></defs>
    <rect width='300' height='420' fill='url(#g)'/>
    <text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle'
          font-family='Cairo, sans-serif' font-size='18' font-weight='700' fill='#fff'>
      ${safe}
    </text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
