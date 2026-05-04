import { createClient } from '@/lib/supabase/server';
import { getSiteSettings } from '@/lib/data';
import ProfileForm from '@/components/account/profile-form';

export const metadata = { title: 'حسابي | مركز إنفينيتي' };

export default async function AccountPage() {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  const [{ data: student }, settings] = await Promise.all([
    supa
      .from('students')
      .select('full_name, phone, governorate, address, grade_level, books_ordered_count, cap_override')
      .eq('id', user!.id)
      .maybeSingle(),
    getSiteSettings(),
  ]);

  const cap = student?.cap_override ?? settings?.student_book_cap ?? 10;
  const ordered = student?.books_ordered_count ?? 0;

  return (
    <ProfileForm
      initial={{
        full_name: student?.full_name ?? null,
        phone: student?.phone ?? null,
        governorate: student?.governorate ?? null,
        address: student?.address ?? null,
        grade_level: student?.grade_level ?? null,
      }}
      booksOrderedCount={ordered}
      cap={cap}
    />
  );
}
