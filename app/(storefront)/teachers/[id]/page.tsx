import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTeacher, getTeacherBooks, getAvailabilitySummary } from '@/lib/data';
import BookCard from '@/components/storefront/book-card';

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const teacher = await getTeacher(parseInt(id, 10));
  if (!teacher) return { title: 'المدرس غير موجود' };
  return {
    title: `${teacher.name_ar} | مكتبة إنفينيتي`,
    description: teacher.description ?? teacher.subject ?? undefined,
  };
}

export default async function TeacherProfilePage({ params }: PageProps) {
  const { id } = await params;
  const teacherId = parseInt(id, 10);
  if (!Number.isFinite(teacherId)) notFound();

  const teacher = await getTeacher(teacherId);
  if (!teacher) notFound();

  const books = await getTeacherBooks(teacherId);
  const availability = await getAvailabilitySummary(books.map((b) => b.id));

  const placeholder =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'><circle cx='75' cy='75' r='75' fill='%23dcebe5'/><text x='50%' y='55%' text-anchor='middle' font-size='64' fill='%233c655a' font-family='Cairo'>${teacher.name_ar.charAt(0)}</text></svg>`
    );

  return (
    <>
      {/* Teacher header */}
      <section className="bg-page-header text-white py-14">
        <div className="container-app">
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-right">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white overflow-hidden relative shrink-0">
              <Image
                src={teacher.photo_url ?? placeholder}
                alt={teacher.name_ar}
                fill
                sizes="160px"
                className="object-cover"
                priority
                unoptimized={!teacher.photo_url}
              />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold mb-2">{teacher.name_ar}</h1>
              {teacher.subject && <p className="text-xl opacity-90 mb-2">{teacher.subject}</p>}
              {teacher.governorate && (
                <p className="opacity-75">
                  <i className="fa-solid fa-location-dot ml-1" />
                  {teacher.governorate}
                </p>
              )}
              <div className="flex gap-3 mt-4 justify-center md:justify-start">
                {teacher.facebook_url && (
                  <a href={teacher.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                     className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors">
                    <i className="fa-brands fa-facebook-f" />
                  </a>
                )}
                {teacher.youtube_url && (
                  <a href={teacher.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
                     className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors">
                    <i className="fa-brands fa-youtube" />
                  </a>
                )}
                {teacher.website_url && (
                  <a href={teacher.website_url} target="_blank" rel="noopener noreferrer" aria-label="Website"
                     className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors">
                    <i className="fa-solid fa-globe" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bio */}
      {teacher.description && (
        <section className="py-10">
          <div className="container-app max-w-3xl">
            <div className="card p-6">
              <h2 className="font-bold text-primary-dark mb-3">نبذة عن المدرس</h2>
              <p className="leading-loose text-ink/80 whitespace-pre-wrap">{teacher.description}</p>
            </div>
          </div>
        </section>
      )}

      {/* Books */}
      <section className="section">
        <div className="container-app">
          <h2 className="section-title">كتب المدرس</h2>
          <p className="section-subtitle">{books.length} {books.length === 1 ? 'كتاب' : 'كتب'} متاحة</p>
          {books.length === 0 ? (
            <p className="text-center text-[#666]">لا توجد كتب لهذا المدرس حاليًا.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {books.map((b) => (
                <BookCard
                  key={b.id}
                  book={{ ...b, teacher: { id: teacher.id, name_ar: teacher.name_ar, photo_url: teacher.photo_url } }}
                  inStockBranches={availability.get(b.id)?.in_stock_branches ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
