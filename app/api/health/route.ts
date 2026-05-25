/**
 * GET /api/health — liveness + readiness probe.
 *
 * Returns 200 with a tiny JSON body summarising:
 *   - liveness: this handler can run (process is up).
 *   - readiness: the Supabase connection can serve a trivial query.
 *
 * Public — does not return any sensitive detail. Vercel's healthcheck
 * cron + uptime monitors can hit this without auth.
 *
 * Response shape:
 *   { ok: true, checks: { supabase: 'ok' | 'fail' }, ts }
 *
 * If `supabase` fails the handler still returns 200 with the failure
 * in the body, so a strict monitor can alert on body content rather
 * than HTTP status. Returning non-200 would interact badly with
 * Vercel's automatic restart heuristics.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HealthCheck {
  supabase: 'ok' | 'fail';
}

export async function GET() {
  const checks: HealthCheck = { supabase: 'ok' };

  try {
    const admin = createAdminClient();
    // Cheapest query: HEAD against a tiny static table. site_settings
    // is one row, indexed by primary key.
    const { error } = await admin.from('site_settings').select('id').limit(1);
    if (error) {
      checks.supabase = 'fail';
      log.error('health', 'supabase_check_failed', {
        code: error.code,
        message: error.message,
      });
    }
  } catch (err) {
    checks.supabase = 'fail';
    log.error('health', 'supabase_unreachable', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json(
    {
      ok: checks.supabase === 'ok',
      checks,
      ts: new Date().toISOString(),
    },
    {
      // Never cache health probes; staleness defeats the purpose.
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
