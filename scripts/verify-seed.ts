/**
 * Post-seed sanity check.
 * Run: npx tsx scripts/verify-seed.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const tables = [
    'branches', 'teachers', 'books', 'branch_stock',
    'shipping_rates', 'site_settings', 'admin_users', 'site_content',
  ];
  console.log('=== Row counts ===');
  for (const t of tables) {
    const { count } = await supa.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t.padEnd(18)} ${count}`);
  }

  const { data: admin } = await supa.from('admin_users').select('id, role, mfa_enabled');
  console.log('\n=== Admin users ===');
  console.log(admin);

  const { data: branches } = await supa.from('branches').select('id, slug, name_ar');
  console.log('\n=== Branches ===');
  branches?.forEach(b => console.log(`  ${b.slug.padEnd(10)} ${b.name_ar}`));

  const { data: stockSum } = await supa
    .from('branch_stock')
    .select('branch_id, quantity');
  const perBranch: Record<string, number> = {};
  stockSum?.forEach(r => {
    perBranch[r.branch_id] = (perBranch[r.branch_id] ?? 0) + (r.quantity ?? 0);
  });
  console.log('\n=== Total stock per branch ===');
  Object.entries(perBranch).forEach(([bid, qty]) => {
    const name = branches?.find(b => b.id === bid)?.name_ar ?? bid;
    console.log(`  ${name.padEnd(20)} ${qty}`);
  });

  const { data: flagged } = await supa
    .from('books')
    .select('id, title_ar')
    .eq('needs_review', true);
  console.log(`\n=== Books flagged for review (${flagged?.length ?? 0}) — had negative stock in books.md ===`);
  flagged?.forEach(b => console.log(`  ${b.id}: ${b.title_ar}`));

  const { data: sample } = await supa
    .from('books')
    .select('id, title_ar, cover_url')
    .not('cover_url', 'is', null)
    .limit(3);
  console.log('\n=== Sample book covers (public URLs) ===');
  sample?.forEach(b => console.log(`  ${b.id}: ${b.cover_url?.slice(0, 90)}`));

  const { data: teacherSample } = await supa
    .from('teachers')
    .select('id, name_ar, photo_url')
    .limit(2);
  console.log('\n=== Sample teacher photos ===');
  teacherSample?.forEach(t => console.log(`  ${t.id}: ${t.name_ar.padEnd(20)} ${t.photo_url?.slice(0, 90)}`));

  const { data: settings } = await supa.from('site_settings').select('*').single();
  console.log('\n=== site_settings ===');
  console.log(`  free_shipping_threshold: ${settings?.free_shipping_threshold}`);
  console.log(`  student_book_cap:        ${settings?.student_book_cap}`);
  console.log(`  reservation_hold_hours:  ${settings?.reservation_hold_hours}`);
  console.log(`  support_phone:           ${settings?.support_phone}`);
}

main().catch(e => { console.error(e); process.exit(1); });
