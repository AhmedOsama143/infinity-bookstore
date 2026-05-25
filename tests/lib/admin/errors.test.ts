/**
 * Unit tests for the admin-action error sanitizer.
 *
 * Q-12: every admin server action routes its Supabase errors through
 * translateDbError so raw schema names / RLS denials / SQLSTATE detail
 * never leak to the client. Keep the translation table covered.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the log helper before importing the SUT so we can assert it
// receives the raw error.
const logErrorMock = vi.fn();
vi.mock('@/lib/log', () => ({
  log: {
    error: (...args: unknown[]) => logErrorMock(...args),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { translateDbError } from '@/lib/admin/errors';

beforeEach(() => {
  logErrorMock.mockReset();
});

describe('translateDbError', () => {
  it('maps known SQLSTATEs to Arabic user-facing messages', () => {
    expect(translateDbError({ message: 'duplicate key', code: '23505' }, 'a', 'b')).toBe(
      'هذا السجل موجود بالفعل'
    );
    expect(translateDbError({ message: 'fk', code: '23503' }, 'a', 'b')).toBe(
      'العملية مرفوضة — هذا السجل مرتبط بسجلات أخرى'
    );
    expect(translateDbError({ message: 'null', code: '23502' }, 'a', 'b')).toBe(
      'بيانات مطلوبة مفقودة'
    );
    expect(translateDbError({ message: 'check', code: '23514' }, 'a', 'b')).toBe(
      'القيمة المُدخلة غير مسموح بها'
    );
    expect(translateDbError({ message: 'rls', code: '42501' }, 'a', 'b')).toBe(
      'الصلاحية غير كافية لهذه العملية'
    );
    expect(translateDbError({ message: 'not found', code: 'PGRST116' }, 'a', 'b')).toBe(
      'السجل غير موجود'
    );
  });

  it('falls back to RLS detection when there is no SQLSTATE', () => {
    expect(
      translateDbError(
        { message: 'new row violates row-level security policy for table "books"' },
        'a',
        'b'
      )
    ).toBe('الصلاحية غير كافية لهذه العملية');
  });

  it('translates business-logic codes raised by triggers', () => {
    expect(translateDbError({ message: 'OUT_OF_STOCK: book 42' }, 'a', 'b')).toBe(
      'أحد الكتب غير متوفر بالكمية المطلوبة في هذا الفرع'
    );
    expect(translateDbError({ message: 'BOOK_CAP_EXCEEDED: 11>10' }, 'a', 'b')).toBe(
      'تجاوز العميل الحد الأقصى للكتب المسموح بها'
    );
  });

  it('returns the generic Arabic message when nothing matches', () => {
    expect(
      translateDbError({ message: 'something unexpected', code: '99999' }, 'a', 'b')
    ).toBe('حدث خطأ، يرجى المحاولة مرة أخرى');
  });

  it('logs the raw error to the structured logger every time', () => {
    translateDbError(
      { message: 'unique_violation', code: '23505', details: 'Key (id)=(42) already exists.' },
      'admin/books',
      'create_failed',
      { bookId: 42 }
    );
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    const [area, event, fields] = logErrorMock.mock.calls[0];
    expect(area).toBe('admin/books');
    expect(event).toBe('create_failed');
    expect(fields).toMatchObject({
      code: '23505',
      message: 'unique_violation',
      details: 'Key (id)=(42) already exists.',
      bookId: 42,
    });
  });
});
