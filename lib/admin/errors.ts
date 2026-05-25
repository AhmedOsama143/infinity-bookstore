/**
 * Translate raw Supabase/Postgres errors into safe user-facing strings.
 *
 * Why: returning `error.message` directly to the client leaks schema names,
 * column names, RLS policy denials ("new row violates RLS for table X"),
 * and foreign-key constraint names — all useful intel for an attacker
 * mapping the database, and confusing for a non-technical staff user.
 *
 * Pattern: every admin server action calls this on its error path:
 *   if (error) return { error: translateDbError(error, 'admin/books', 'update') };
 *
 * The raw message ALWAYS goes to structured logs so support can debug.
 * The returned string is the only thing the client sees.
 */
import { log } from '@/lib/log';

interface PgErrorLike {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

const KNOWN_CODES: Record<string, string> = {
  // Postgres SQLSTATEs we expect to see and can speak to specifically.
  '23505': 'هذا السجل موجود بالفعل',          // unique_violation
  '23503': 'العملية مرفوضة — هذا السجل مرتبط بسجلات أخرى', // foreign_key_violation
  '23502': 'بيانات مطلوبة مفقودة',             // not_null_violation
  '23514': 'القيمة المُدخلة غير مسموح بها',     // check_violation
  '42501': 'الصلاحية غير كافية لهذه العملية',  // insufficient_privilege
  'PGRST116': 'السجل غير موجود',               // PostgREST not found
};

const GENERIC = 'حدث خطأ، يرجى المحاولة مرة أخرى';

export function translateDbError(
  error: PgErrorLike,
  area: string,
  event: string,
  fields?: Record<string, unknown>
): string {
  // Server log keeps everything (message, code, details, hint) for support.
  log.error(area, event, {
    code: error.code ?? null,
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
    ...fields,
  });

  if (error.code && KNOWN_CODES[error.code]) {
    return KNOWN_CODES[error.code];
  }

  // Pattern-based fallbacks for messages that come without a code.
  const lower = error.message.toLowerCase();
  if (lower.includes('row-level security') || lower.includes('rls')) {
    return 'الصلاحية غير كافية لهذه العملية';
  }
  if (lower.includes('out_of_stock')) {
    return 'أحد الكتب غير متوفر بالكمية المطلوبة في هذا الفرع';
  }
  if (lower.includes('book_cap_exceeded')) {
    return 'تجاوز العميل الحد الأقصى للكتب المسموح بها';
  }

  return GENERIC;
}
