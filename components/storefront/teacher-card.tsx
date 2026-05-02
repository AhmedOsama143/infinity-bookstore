import Link from 'next/link';
import Image from 'next/image';
import type { Teacher } from '@/lib/types';

interface Props {
  teacher: Teacher;
  booksCount?: number;
}

export default function TeacherCard({ teacher, booksCount }: Props) {
  const placeholder =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23dcebe5'/><text x='50%' y='55%' text-anchor='middle' font-size='40' fill='%233c655a' font-family='Cairo'>${teacher.name_ar.charAt(0)}</text></svg>`
    );

  return (
    <Link href={`/teachers/${teacher.id}`} className="block">
      <div className="card card-hover p-4 sm:p-6 md:p-8 text-center">
        <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 border-[3px] border-primary-light relative">
          <Image
            src={teacher.photo_url ?? placeholder}
            alt={teacher.name_ar}
            fill
            sizes="96px"
            className="object-cover"
            unoptimized={!teacher.photo_url}
          />
        </div>
        <h3 className="text-[1.1rem] font-bold mb-1">{teacher.name_ar}</h3>
        {teacher.subject && (
          <p className="text-primary font-semibold text-sm mb-2">{teacher.subject}</p>
        )}
        {teacher.governorate && (
          <p className="text-[#888] text-xs mb-2">
            <i className="fa-solid fa-location-dot ml-1" />
            {teacher.governorate}
          </p>
        )}
        {booksCount !== undefined && (
          <p className="text-xs text-accent-dark font-semibold">
            {booksCount} {booksCount === 1 ? 'كتاب' : 'كتب'}
          </p>
        )}
      </div>
    </Link>
  );
}
