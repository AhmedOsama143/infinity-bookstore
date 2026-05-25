/**
 * Unit tests for the OAuth `next` redirect sanitizer.
 *
 * S-03 / S-05 hinge on this function — every path the user could be sent
 * to after auth runs through it. If we ever weaken it, these tests should
 * catch the regression before it ships.
 */
import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/auth/safe-next';

describe('safeNextPath', () => {
  describe('accepts same-origin paths', () => {
    it.each([
      '/',
      '/account',
      '/account/orders',
      '/checkout?step=1',
      '/books/42',
      '/search?q=algebra&grade=second',
      '/legal/privacy#data',
    ])('passes through %s', (path) => {
      expect(safeNextPath(path)).toBe(path);
    });
  });

  describe('rejects open-redirect attempts', () => {
    it.each([
      ['https://evil.com', 'absolute https'],
      ['http://evil.com/x', 'absolute http'],
      ['//evil.com', 'protocol-relative'],
      ['//evil.com/path', 'protocol-relative with path'],
      ['javascript:alert(1)', 'javascript scheme'],
      ['data:text/html,foo', 'data scheme'],
      ['mailto:hack@evil.com', 'mailto scheme'],
      ['/\\evil.com', 'backslash trick (Windows-ish protocol-relative)'],
      ['ftp://anything', 'ftp scheme'],
    ])('rejects %s (%s) → fallback', (path) => {
      expect(safeNextPath(path)).toBe('/');
    });

    it('uses the custom fallback when one is provided', () => {
      expect(safeNextPath('https://evil.com', '/login')).toBe('/login');
    });
  });

  describe('handles bad input types', () => {
    it.each([null, undefined, 0, false, {}, [], NaN])(
      'returns fallback for non-string input %s',
      (input) => {
        expect(safeNextPath(input)).toBe('/');
      }
    );

    it('rejects empty string', () => {
      expect(safeNextPath('')).toBe('/');
    });

    it('rejects a string that does not start with /', () => {
      expect(safeNextPath('account')).toBe('/');
      expect(safeNextPath('  /account')).toBe('/'); // leading whitespace
    });
  });
});
