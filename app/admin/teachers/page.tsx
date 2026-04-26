import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import { requireFullAdmin } from '@/lib/admin/auth';

export default async function AdminTeachersPage() {
  await requireFullAdmin();
  const supa = await createClient();

  const { data: teachers } = await supa
    .from('teachers')
    .select('id, name_ar, governorate, subject, photo_url, is_active')
    .order('name_ar');

  // Per-teacher book counts
  const { data: bookCounts } = await supa.from('books').select('teacher_id, id').not('teacher_id', 'is', null);
  const counts = new Map<number, number>();
  for (const b of bookCounts ?? []) {
    counts.set(b.teacher_id as number, (counts.get(b.teacher_id as number) ?? 0) + 1);
  }

  return (
    <PageShell
      title="المدرسين"
      subtitle={`${teachers?.length ?? 0} مدرس`}
      actions={
        <Link href="/admin/teachers/new" className="btn bg-white text-primary-dark hover:bg-bg-light px-5 py-2 text-sm">
          <i className="fa-solid fa-plus ml-2" />
          إضافة مدرس جديد
        </Link>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {(teachers ?? []).map((t: any) => {
          const placeholder =
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23dcebe5'/><text x='50%' y='55%' text-anchor='middle' font-size='40' fill='%233c655a' font-family='Cairo'>${t.name_ar.charAt(0)}</text></svg>`);
          return (
            <Link key={t.id} href={`/admin/teachers/${t.id}/edit`} className="card card-hover p-5 text-center">
              <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 relative">
                <Image
                  src={t.photo_url ?? placeholder}
                  alt={t.name_ar}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized={!t.photo_url}
                />
              </div>
              <div className="font-bold">{t.name_ar}</div>
              {t.subject && <div className="text-xs text-primary mt-1">{t.subject}</div>}
              {t.governorate && <div className="text-xs text-[#666]">{t.governorate}</div>}
              <div className="text-xs text-accent-dark mt-2 font-bold">{counts.get(t.id) ?? 0} كتاب</div>
              {!t.is_active && <div className="text-[10px] text-danger mt-1">معطل</div>}
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
