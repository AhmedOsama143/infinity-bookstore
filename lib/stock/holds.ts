/**
 * Cart soft-hold helpers — Phase C.
 *
 * A "hold" is a short-lived reservation a customer's cart imposes on the
 * aggregate available stock for a book. Holds:
 *   • are owner-scoped (auth.uid()) — guests don't get holds in this MVP
 *   • auto-expire after `HOLD_MINUTES` of inactivity (cron deletes them)
 *   • are refreshed on every cart re-validation
 *   • are dropped on cart remove/clear and on placeOrder success
 *
 * All operations use the service-role client because cart_holds has no public
 * RLS policies — the Stock Integrity module is the single writer.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/log';

export const HOLD_MINUTES = 15;

export async function acquireHold(userId: string, bookId: number, quantity: number): Promise<void> {
  if (quantity <= 0) {
    await releaseHold(userId, bookId);
    return;
  }
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();
  const { error } = await admin
    .from('cart_holds')
    .upsert(
      {
        user_id: userId,
        book_id: bookId,
        quantity,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' }
    );
  // Holds are advisory UX (the atomic claim at order time is the real guard),
  // so a failure here is non-fatal — but it must not vanish silently.
  if (error) log.error('stock/holds', 'acquire_failed', { userId, bookId, quantity, message: error.message });
}

export async function releaseHold(userId: string, bookId: number): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('cart_holds').delete().eq('user_id', userId).eq('book_id', bookId);
  if (error) log.error('stock/holds', 'release_failed', { userId, bookId, message: error.message });
}

export async function releaseAllHoldsForUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('cart_holds').delete().eq('user_id', userId);
  if (error) log.error('stock/holds', 'release_all_failed', { userId, message: error.message });
}
