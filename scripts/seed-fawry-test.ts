/**
 * Fawry sandbox test fixtures.
 *
 * Idempotent. Inserts (or updates) three test books with predictable IDs,
 * round prices, and stock at a single branch. Used by:
 *   • Slice 3 signature-builder unit tests (known item IDs/prices → known
 *     signature bytes).
 *   • Slice 4 manual end-to-end checkout against atfawry.fawrystaging.com.
 *
 * Test book IDs are chosen well above the catalogue's seeded range (1–47)
 * so they don't collide with the real catalogue if both seeds run.
 *
 * Run: npx tsx scripts/seed-fawry-test.ts
 *      pnpm seed:fawry
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SR_KEY) {
  console.error('Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const supa = createClient(SUPA_URL, SR_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface TestBook {
  id: number;
  title_ar: string;
  price: number;
  stock: number;
}

// Round prices keep signature debugging readable (50.00, 100.00, 150.00).
// One book sits at the discount edge so we exercise final_price ≠ price.
const TEST_BOOKS: TestBook[] = [
  { id: 9001, title_ar: 'كتاب اختبار فوري — أ', price: 50.0, stock: 10 },
  { id: 9002, title_ar: 'كتاب اختبار فوري — ب', price: 100.0, stock: 10 },
  { id: 9003, title_ar: 'كتاب اختبار فوري — ج', price: 150.0, stock: 10 },
];

async function getFirstBranchId(): Promise<string> {
  const { data, error } = await supa
    .from('branches')
    .select('id, name_ar, slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load branches: ${error.message}`);
  if (!data) {
    throw new Error(
      'No active branch found. Run the main seed (pnpm seed) first to populate branches.'
    );
  }
  console.log(`  → using branch: ${data.name_ar} (${data.slug})`);
  return data.id;
}

async function upsertBook(b: TestBook): Promise<void> {
  const row = {
    id: b.id,
    title_ar: b.title_ar,
    grade_level: 'first_secondary' as const,
    book_type: 'external_ar' as const,
    description: 'Fixture for Fawry sandbox testing. Safe to delete.',
    price: b.price,
    discount_pct: 0,
    is_active: true,
    needs_review: false,
  };
  const { error } = await supa.from('books').upsert(row, { onConflict: 'id' });
  if (error) throw new Error(`Failed to upsert book ${b.id}: ${error.message}`);
  console.log(`  ✓ book ${b.id}: ${b.title_ar} @ ${b.price.toFixed(2)} EGP`);
}

async function upsertStock(branchId: string, bookId: number, qty: number): Promise<void> {
  // Set absolute stock (not delta) so re-runs are idempotent. reserved_quantity
  // is left at 0 — the trigger in 015 will manage it for any orders placed
  // against these test rows.
  const { error } = await supa
    .from('branch_stock')
    .upsert(
      { branch_id: branchId, book_id: bookId, quantity: qty, reserved_quantity: 0 },
      { onConflict: 'branch_id,book_id' }
    );
  if (error) throw new Error(`Failed to upsert stock for book ${bookId}: ${error.message}`);
  console.log(`  ✓ stock book ${bookId} → ${qty} at branch`);
}

async function main(): Promise<void> {
  console.log('Seeding Fawry test fixtures…');
  const branchId = await getFirstBranchId();

  for (const b of TEST_BOOKS) {
    await upsertBook(b);
    await upsertStock(branchId, b.id, b.stock);
  }

  console.log('Done. Three test books available with stock at the first branch.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
