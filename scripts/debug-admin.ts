import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: admins } = await supa
    .from('admin_users')
    .select('id, role, branch_id');
  console.log('admin_users rows:');
  console.table(admins ?? []);

  if (admins && admins.length > 0) {
    for (const a of admins) {
      const { data: u } = await supa.auth.admin.getUserById(a.id);
      console.log(`\nUser ${a.id}:`);
      console.log('  email:', u.user?.email);
      console.log('  app_metadata:', JSON.stringify(u.user?.app_metadata));
      console.log('  user_metadata:', JSON.stringify(u.user?.user_metadata));
    }
  }
}
main();
