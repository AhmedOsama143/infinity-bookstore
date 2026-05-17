import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data, error } = await supa
    .from('teachers')
    .select('id, name_ar, is_active, photo_url, subject, governorate')
    .in('id', [15, 21]);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  for (const t of data!) {
    console.log(`\n--- Teacher ${t.id} ---`);
    console.log('  name_ar:    ', t.name_ar);
    console.log('  governorate:', t.governorate);
    console.log('  subject:    ', t.subject);
    console.log('  photo_url:  ', t.photo_url);
  }
}

main();
