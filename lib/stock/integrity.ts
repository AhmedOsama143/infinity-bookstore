/**
 * Stock Integrity Agent — single source of truth for every stock-changing decision.
 *
 * Customers are blocked from exceeding live available stock at any touchpoint.
 * Staff (manual orders, counter sales) are allowed to oversell with explicit
 * confirmation; the overage is flagged and logged so warehouse / procurement
 * can pick it up.
 *
 * Every decision is persisted to `stock_decisions` for reconciliation. Logging
 * is best-effort — if it fails, the decision still returns. Decisions never
 * trust client-supplied stock numbers; they always re-fetch from Supabase.
 *
 * Fail-safe: if stock data is unavailable, default to BLOCK for customers and
 * WARN+ALLOW for staff (staff are ground truth for offline events).
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { HOLD_MINUTES, releaseHold, releaseAllHoldsForUser } from './holds';

export type ActorType = 'customer' | 'staff';
export type StockAction = 'add' | 'increment' | 'set_quantity' | 'revalidate';
export type DecisionKind = 'allow' | 'block' | 'adjust' | 'warn_and_allow';

export interface StockDecisionInput {
  actor_type: ActorType;
  action: StockAction;
  book_id: number;
  /**
   * Semantics depend on `action`:
   *  - 'add'           → number of new units the user wants to add
   *  - 'increment'     → delta to apply (typically 1 or -1)
   *  - 'set_quantity'  → desired new total qty for this line
   *  - 'revalidate'    → existing cart qty to verify
   */
  requested_qty: number;
  current_in_cart: number;
  /** Branch scope. Null/undefined → sum across all active branches. */
  branch_id?: string | null;
  touchpoint: string;
  /** Optional note from staff overrides. */
  note?: string | null;
}

export interface StockDecision {
  decision: DecisionKind;
  actor_type: ActorType;
  book_id: number;
  title_ar: string | null;
  requested_qty: number;
  effective_qty: number;
  available_stock: number;
  final_qty: number;
  user_message: string | null;
  internal_flags: string[];
  requires_user_confirmation: boolean;
}

interface BookSnapshot {
  id: number;
  title_ar: string;
  is_active: boolean;
}

interface StockSnapshot {
  /** quantity − reserved_quantity, scoped per `branch_id` rule. */
  available: number;
  /** True if we couldn't reach the DB or got partial data. */
  failed: boolean;
}

function computeEffectiveQty(input: StockDecisionInput): number {
  switch (input.action) {
    case 'increment':
      return Math.max(0, input.current_in_cart + input.requested_qty);
    case 'set_quantity':
    case 'revalidate':
      return Math.max(0, input.requested_qty);
    case 'add':
    default:
      return Math.max(0, input.current_in_cart + input.requested_qty);
  }
}

async function fetchBook(bookId: number): Promise<BookSnapshot | null> {
  try {
    const supa = await createClient();
    const { data } = await supa
      .from('books')
      .select('id, title_ar, is_active')
      .eq('id', bookId)
      .maybeSingle();
    return (data as BookSnapshot | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Phase D atomic claim. One round-trip: under a per-book advisory lock, the
 * SQL function recomputes availability (excluding our own hold), grants
 * `min(requested, max_grantable)`, and upserts the cart_holds row. Returns
 * the granted quantity — which the caller treats as the authoritative new
 * cart-line value for this book.
 *
 * Fails closed: any RPC error returns `null` and we fall back to the read-only
 * snapshot path so the customer still gets a friendly fail-safe block.
 */
async function tryAtomicHold(
  userId: string,
  bookId: number,
  requestedQty: number
): Promise<number | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('try_acquire_cart_hold', {
      p_book_id: bookId,
      p_user_id: userId,
      p_requested_qty: requestedQty,
      p_hold_minutes: HOLD_MINUTES,
    });
    if (error || data === null || data === undefined) return null;
    return Math.max(0, Number(data));
  } catch {
    return null;
  }
}

async function fetchAvailable(
  bookId: number,
  branchId: string | null | undefined,
  viewerUserId: string | null
): Promise<StockSnapshot> {
  try {
    // Cart-level aggregate (no branch scope) — subtract OTHER customers' active
    // holds via the SQL function. The viewer's own hold is excluded so they
    // always see their own units as available.
    if (!branchId) {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc('available_for_other_carts', {
        p_book_id: bookId,
        p_viewer_user_id: viewerUserId,
      });
      if (error || data === null || data === undefined) {
        return { available: 0, failed: true };
      }
      return { available: Number(data), failed: false };
    }

    // Branch-scoped path (staff manual orders, checkout per-branch checks).
    // Holds are aggregate, not branch-specific, so we deliberately do not
    // subtract them here — the existing reserved_quantity is the correct
    // per-branch counter and what the trigger uses.
    const supa = await createClient();
    const { data, error } = await supa
      .from('branch_stock')
      .select('quantity, reserved_quantity, branch:branches!inner(id, is_active)')
      .eq('book_id', bookId)
      .eq('branch_id', branchId);
    if (error || !data) return { available: 0, failed: true };

    let available = 0;
    for (const row of data as Array<{
      quantity: number;
      reserved_quantity: number;
      branch: { is_active: boolean } | { is_active: boolean }[];
    }>) {
      const branch = Array.isArray(row.branch) ? row.branch[0] : row.branch;
      if (!branch?.is_active) continue;
      available += Math.max(0, row.quantity - row.reserved_quantity);
    }
    return { available, failed: false };
  } catch {
    return { available: 0, failed: true };
  }
}

async function logDecision(input: StockDecisionInput, decision: StockDecision): Promise<void> {
  try {
    const supa = await createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    await supa.from('stock_decisions').insert({
      actor_type: input.actor_type,
      actor_id: user?.id ?? null,
      touchpoint: input.touchpoint,
      action: input.action,
      book_id: input.book_id,
      branch_id: input.branch_id ?? null,
      requested_qty: input.requested_qty,
      current_in_cart: input.current_in_cart,
      effective_qty: decision.effective_qty,
      available_stock: decision.available_stock,
      final_qty: decision.final_qty,
      decision: decision.decision,
      flags: decision.internal_flags,
      user_message: decision.user_message,
      note: input.note ?? null,
    });
  } catch {
    // Audit must not break the user flow.
  }
}

export async function validateStock(input: StockDecisionInput): Promise<StockDecision> {
  const effective = computeEffectiveQty(input);
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  const viewerUserId = user?.id ?? null;

  // Always fetch the book first — the atomic claim is irrelevant for missing
  // or delisted books (we still want to drop any stale hold for them).
  const book = await fetchBook(input.book_id);
  const title = book?.title_ar ?? null;

  const useAtomic =
    input.actor_type === 'customer' &&
    viewerUserId !== null &&
    !input.branch_id &&
    book !== null &&
    book.is_active;

  let snap: StockSnapshot;
  if (useAtomic) {
    // Phase D: read availability + upsert hold under a per-book advisory lock
    // in one SQL call. Two simultaneous add-to-cart calls for the same book
    // serialize and cannot double-grant.
    const granted = await tryAtomicHold(viewerUserId!, input.book_id, effective);
    if (granted === null) {
      snap = { available: 0, failed: true };
    } else {
      // The function returns granted = min(requested, max_grantable). We feed
      // this into decide() as snap.available — it represents the upper bound
      // on the cart line the user is allowed after this call. decide() then
      // produces the right allow / adjust / block path.
      snap = { available: granted, failed: false };
    }
  } else {
    snap = await fetchAvailable(input.book_id, input.branch_id, viewerUserId);
  }

  const decision = decide({
    input,
    effective,
    book,
    snap,
    title,
  });

  // Drop any stale hold for delisted / not-found books even though the
  // atomic path was skipped above.
  if (
    viewerUserId &&
    !input.branch_id &&
    (decision.internal_flags.includes('delisted') ||
      decision.internal_flags.includes('book_not_found'))
  ) {
    void releaseHold(viewerUserId, input.book_id);
  }

  // Fire-and-forget; audit is best-effort.
  void logDecision(input, decision);
  return decision;
}

function decide(args: {
  input: StockDecisionInput;
  effective: number;
  book: BookSnapshot | null;
  snap: StockSnapshot;
  title: string | null;
}): StockDecision {
  const { input, effective, book, snap, title } = args;
  const base = {
    actor_type: input.actor_type,
    book_id: input.book_id,
    title_ar: title,
    requested_qty: input.requested_qty,
    effective_qty: effective,
    available_stock: snap.available,
  };

  // Book missing or delisted → block for everyone (even staff shouldn't sell a delisted SKU).
  if (!book) {
    return {
      ...base,
      decision: 'block',
      final_qty: input.current_in_cart,
      user_message: 'هذا الكتاب لم يعد متاحًا في المتجر.',
      internal_flags: ['book_not_found'],
      requires_user_confirmation: false,
    };
  }
  if (!book.is_active) {
    return {
      ...base,
      decision: 'block',
      final_qty: input.current_in_cart,
      user_message: `«${book.title_ar}» لم يعد متاحًا في المتجر.`,
      internal_flags: ['delisted'],
      requires_user_confirmation: false,
    };
  }

  // Fail-safe: stock fetch failed.
  if (snap.failed) {
    if (input.actor_type === 'customer') {
      return {
        ...base,
        decision: 'block',
        final_qty: input.current_in_cart,
        user_message: 'تعذّر التحقق من المخزون الآن. حاول مرة أخرى خلال لحظات.',
        internal_flags: ['fail_safe_block'],
        requires_user_confirmation: false,
      };
    }
    // Staff: ground truth for offline events; let them proceed but warn loudly.
    return {
      ...base,
      decision: 'warn_and_allow',
      final_qty: effective,
      user_message: '⚠ تعذّر التحقق من المخزون لحظيًا. سيتم تسجيل العملية مع علامة مراجعة.',
      internal_flags: ['fail_safe_warn', 'oversold_unknown'],
      requires_user_confirmation: true,
    };
  }

  // Customer branch.
  if (input.actor_type === 'customer') {
    if (snap.available <= 0) {
      return {
        ...base,
        decision: 'block',
        final_qty: 0,
        user_message: `نفدت كمية «${book.title_ar}» حاليًا.`,
        internal_flags: ['out_of_stock'],
        requires_user_confirmation: false,
      };
    }
    if (effective <= snap.available) {
      return {
        ...base,
        decision: 'allow',
        final_qty: effective,
        user_message: null,
        internal_flags: [],
        requires_user_confirmation: false,
      };
    }
    // Effective exceeds available.
    if (snap.available <= input.current_in_cart) {
      return {
        ...base,
        decision: 'block',
        final_qty: input.current_in_cart,
        user_message: `لديك بالفعل أقصى كمية متاحة (${snap.available}) من «${book.title_ar}» في السلة.`,
        internal_flags: ['at_limit'],
        requires_user_confirmation: false,
      };
    }
    return {
      ...base,
      decision: 'adjust',
      final_qty: snap.available,
      user_message: `المتاح فقط ${snap.available} نسخة من «${book.title_ar}» — تم تعديل الكمية.`,
      internal_flags: ['adjusted_down'],
      requires_user_confirmation: true,
    };
  }

  // Staff branch.
  if (effective <= snap.available) {
    return {
      ...base,
      decision: 'allow',
      final_qty: effective,
      user_message: null,
      internal_flags: [],
      requires_user_confirmation: false,
    };
  }
  const overage = effective - snap.available;
  return {
    ...base,
    decision: 'warn_and_allow',
    final_qty: effective,
    user_message: `⚠ هذه العملية ستتجاوز المخزون بـ ${overage} نسخة من «${book.title_ar}». سيتم تسجيلها كطلب مؤجل (backorder).`,
    internal_flags: ['oversold'],
    requires_user_confirmation: true,
  };
}

export interface CartLineDecision {
  book_id: number;
  decision: StockDecision;
}

/**
 * Re-validate every line item in a cart. Use on cart open, mini-cart render,
 * checkout entry, and place-order pre-check.
 *
 * Result is per-line; UI is responsible for showing the diff and gating
 * progression behind explicit user confirmation when any line was adjusted.
 */
export async function revalidateCart(
  items: Array<{ book_id: number; quantity: number }>,
  touchpoint = 'cart_revalidate'
): Promise<CartLineDecision[]> {
  if (items.length === 0) return [];
  return Promise.all(
    items.map(async (item) => ({
      book_id: item.book_id,
      decision: await validateStock({
        actor_type: 'customer',
        action: 'revalidate',
        book_id: item.book_id,
        requested_qty: item.quantity,
        current_in_cart: item.quantity,
        touchpoint,
      }),
    }))
  );
}

/**
 * Drop the soft-hold for a single book in the current customer's cart.
 * Called when the user removes a line. No-op for guests.
 */
export async function dropCartHold(bookId: number): Promise<void> {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return;
  await releaseHold(user.id, bookId);
}

/**
 * Drop every soft-hold for the current customer. Called on cart clear and
 * after a successful order placement (the order's reserved_quantity now
 * supersedes the hold).
 */
export async function dropAllCartHolds(): Promise<void> {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return;
  await releaseAllHoldsForUser(user.id);
}
