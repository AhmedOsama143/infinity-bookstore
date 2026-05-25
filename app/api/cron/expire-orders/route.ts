/**
 * GET /api/cron/expire-orders — sweep stale pending online orders past their
 * payment_expires_at window and release the branch stock they're holding.
 *
 * Slice 8. Runs hourly via Vercel Cron (see vercel.json). Without this,
 * PAYATFAWRY references that the customer never pays sit forever in the
 * 'pending' state and the migration-015 reservation trigger never releases
 * branch stock back into inventory. Fawry's `EXPIRED` webhook is best-effort
 * and not reliably delivered, so we can't depend on it.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron sends
 * this header automatically when `crons` is configured in vercel.json. The
 * env var must be set in Vercel project settings — the secret never lives
 * in the repo.
 *
 * For each candidate order we first do a status poll. If Fawry reports the
 * order as PAID, we reconcile instead of cancelling — covers the unlikely
 * but possible case where the customer paid at a kiosk in the final minutes
 * before expiry and the webhook was lost.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reconcileOrderWithFawry } from '@/lib/fawry/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Hard cap on how many expired orders we process per cron tick. Hourly cron +
// 200/run = 4800/day, well above realistic abandonment rates. A backlog larger
// than this needs an operator's attention anyway.
const BATCH_LIMIT = 200;

interface SweepResult {
  scanned: number;
  reconciled_paid: number;
  cancelled: number;
  skipped: number;
  errors: number;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail loud — misconfigured deploy. Don't reveal the env-var name in the
    // public response body; the operator will see it in Vercel logs anyway.
    console.error('[cron/expire-orders] CRON_SECRET is unset — refusing to run');
    return NextResponse.json(
      { ok: false, error: { code: 'misconfigured', message: 'cron auth not configured' } },
      { status: 500 }
    );
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: { code: 'forbidden', message: 'forbidden' } },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: candidates, error } = await admin
    .from('orders')
    .select('id, merchant_ref_number, status, payment_status, payment_method, payment_method_detail, fawry_ref_number, total, payment_expires_at')
    .eq('payment_method', 'fawry')
    .eq('payment_status', 'pending')
    .eq('status', 'pending')
    .lt('payment_expires_at', nowIso)
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'query_failed', message: error.message } },
      { status: 500 }
    );
  }

  const result: SweepResult = {
    scanned: candidates?.length ?? 0,
    reconciled_paid: 0,
    cancelled: 0,
    skipped: 0,
    errors: 0,
  };

  for (const order of candidates ?? []) {
    try {
      const ref = order.merchant_ref_number ?? order.id;
      const reconciled = await reconcileOrderWithFawry(admin, ref, {
        id: order.id,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        payment_method_detail: order.payment_method_detail,
        fawry_ref_number: order.fawry_ref_number,
        total: order.total,
      });

      if (reconciled.payment_status === 'paid') {
        result.reconciled_paid += 1;
        continue;
      }

      // Still pending after the poll → genuinely abandoned. Flip status to
      // 'cancelled' which trips the migration-015 trigger and releases the
      // branch reservation back into inventory.
      const { error: updErr } = await admin
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: 'expired',
        })
        .eq('id', order.id)
        .eq('payment_status', 'pending')
        .eq('status', 'pending');

      if (updErr) {
        result.errors += 1;
        await admin.from('payment_events').insert({
          merchant_ref_number: ref,
          order_id: order.id,
          event_type: 'expire_failed',
          raw_payload: { error: updErr.message },
          signature_valid: true,
          processed: false,
          error_message: updErr.message,
        });
        continue;
      }

      await admin.from('payment_events').insert({
        merchant_ref_number: ref,
        order_id: order.id,
        event_type: 'cron_expired',
        raw_payload: { expired_at: order.payment_expires_at },
        signature_valid: true,
        processed: true,
      });
      result.cancelled += 1;
    } catch (err) {
      result.errors += 1;
      const ref = order.merchant_ref_number ?? order.id;
      await admin.from('payment_events').insert({
        merchant_ref_number: ref,
        order_id: order.id,
        event_type: 'cron_error',
        raw_payload: { error: err instanceof Error ? err.message : String(err) },
        signature_valid: true,
        processed: false,
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, data: result });
}
