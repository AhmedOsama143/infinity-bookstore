/**
 * Unit tests for the pure presentation/formatting helpers in lib/utils.
 *
 * These are rendered all over the storefront (prices on every card, WhatsApp
 * deep-links, the no-image fallback cover). formatPrice in particular is on the
 * money-display path, and fallbackCover builds an inline SVG from a book title —
 * so its HTML-escaping is a small but real XSS surface worth pinning.
 */
import { describe, expect, it } from 'vitest';
import {
  formatPrice,
  formatPriceWithDecimals,
  whatsappLink,
  mapsLink,
  fallbackCover,
  gradeLabelAr,
  bookTypeLabelAr,
} from '@/lib/utils';

describe('formatPrice', () => {
  it('rounds to a whole number of EGP and appends the unit', () => {
    expect(formatPrice(250)).toBe('250 جنيه');
    expect(formatPrice(0)).toBe('0 جنيه');
  });

  it('rounds half-up at the integer boundary', () => {
    expect(formatPrice(99.6)).toBe('100 جنيه');
    expect(formatPrice(99.4)).toBe('99 جنيه');
  });
});

describe('formatPriceWithDecimals', () => {
  it('always shows two decimals', () => {
    expect(formatPriceWithDecimals(250)).toBe('250.00 جنيه');
    expect(formatPriceWithDecimals(99.5)).toBe('99.50 جنيه');
    expect(formatPriceWithDecimals(99.999)).toBe('100.00 جنيه');
  });
});

describe('whatsappLink', () => {
  it('builds a bare wa.me link with no prefill', () => {
    expect(whatsappLink('201104605272')).toBe('https://wa.me/201104605272');
  });

  it('URL-encodes the prefill text (Arabic + spaces)', () => {
    const link = whatsappLink('201104605272', 'مرحبا بك');
    expect(link.startsWith('https://wa.me/201104605272?text=')).toBe(true);
    // Spaces must not survive raw, and decoding must round-trip.
    expect(link).not.toContain(' ');
    const text = decodeURIComponent(link.split('text=')[1]);
    expect(text).toBe('مرحبا بك');
  });
});

describe('mapsLink', () => {
  it('returns null when either coordinate is missing', () => {
    expect(mapsLink(null, 30)).toBeNull();
    expect(mapsLink(31, null)).toBeNull();
    expect(mapsLink(null, null)).toBeNull();
  });

  it('builds a maps query when both coordinates are present', () => {
    expect(mapsLink(31.2, 29.9)).toBe('https://maps.google.com/?q=31.2,29.9');
  });

  it('treats 0,0 as valid coordinates (not missing)', () => {
    expect(mapsLink(0, 0)).toBe('https://maps.google.com/?q=0,0');
  });
});

describe('fallbackCover', () => {
  it('returns an inline data-URL SVG (no external request)', () => {
    const url = fallbackCover('الجبر');
    expect(url.startsWith('data:image/svg+xml;utf8,')).toBe(true);
  });

  it('escapes & and < so a malicious title cannot inject SVG/markup', () => {
    // Short input so the slice(0,40) truncation doesn't clip the assertions.
    const url = fallbackCover('<b> & ok');
    const svg = decodeURIComponent(url.replace('data:image/svg+xml;utf8,', ''));
    // Escaping `<` (and `&`) is sufficient for XML text content: only `<` can
    // open an element, so a raw `<b>` from the title can never appear, and
    // ampersands are entity-encoded. (A lone `>` is harmless text, so the
    // implementation deliberately leaves it unescaped.)
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b>');
    expect(svg).toContain('&amp; ok');
  });

  it('truncates very long titles to 40 characters of source text', () => {
    const longTitle = 'ا'.repeat(100);
    const url = fallbackCover(longTitle);
    const svg = decodeURIComponent(url.replace('data:image/svg+xml;utf8,', ''));
    // The escaped, sliced title appears; the full 100-char run does not.
    expect(svg).toContain('ا'.repeat(40));
    expect(svg).not.toContain('ا'.repeat(41));
  });
});

describe('label maps', () => {
  it('covers every grade level', () => {
    expect(gradeLabelAr.first_secondary).toBe('الأول الثانوي');
    expect(gradeLabelAr.second_secondary).toBe('الثاني الثانوي');
    expect(gradeLabelAr.third_secondary).toBe('الثالث الثانوي');
    expect(Object.keys(gradeLabelAr)).toHaveLength(3);
  });

  it('covers every book type', () => {
    expect(bookTypeLabelAr.external_ar).toBe('خارجي');
    expect(bookTypeLabelAr.online_ar).toBe('أونلاين');
  });
});
