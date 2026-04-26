'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Teacher, GradeLevel } from '@/lib/types';
import type { BookSort } from '@/lib/data';
import { gradeLabelAr } from '@/lib/utils';

interface Props {
  teachers: Pick<Teacher, 'id' | 'name_ar'>[];
  grade?: GradeLevel;
  teacherId?: number;
  sort?: BookSort;
  search?: string;
}

const GRADES: { value: GradeLevel; label: string }[] = [
  { value: 'first_secondary', label: gradeLabelAr.first_secondary },
  { value: 'second_secondary', label: gradeLabelAr.second_secondary },
  { value: 'third_secondary', label: gradeLabelAr.third_secondary },
];

export default function BooksFilterBar({
  teachers,
  grade,
  teacherId,
  sort,
  search,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search ?? '');

  function pushWith(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (grade) params.set('grade', grade);
    if (teacherId) params.set('teacher', String(teacherId));
    if (sort) params.set('sort', sort);
    if (search) params.set('search', search);
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/books?${qs}` : '/books'));
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    pushWith({ search: searchValue.trim() });
  }

  const inputClass =
    'w-full px-4 py-2.5 border-2 border-[#e0e0e0] rounded-s text-sm bg-white font-heading focus:border-primary focus:outline-none transition-colors';

  return (
    <form
      onSubmit={onSearchSubmit}
      className={`bg-white p-5 rounded-card shadow-card -mt-8 relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${
        isPending ? 'opacity-70' : ''
      }`}
    >
      <select
        value={teacherId ?? ''}
        onChange={(e) => pushWith({ teacher: e.target.value })}
        className={inputClass}
      >
        <option value="">كل المدرسين</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name_ar}
          </option>
        ))}
      </select>

      <select
        value={grade ?? ''}
        onChange={(e) => pushWith({ grade: e.target.value })}
        className={inputClass}
      >
        <option value="">كل الصفوف</option>
        {GRADES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>

      <select
        value={sort ?? ''}
        onChange={(e) => pushWith({ sort: e.target.value })}
        className={inputClass}
      >
        <option value="">ترتيب حسب</option>
        <option value="price_low">السعر: الأقل أولاً</option>
        <option value="price_high">السعر: الأعلى أولاً</option>
        <option value="newest">الأحدث</option>
      </select>

      <div className="relative">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="ابحث عن كتاب..."
          className={`${inputClass} pl-10`}
        />
        <button
          type="submit"
          aria-label="بحث"
          className="absolute left-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary-dark p-2"
        >
          <i className="fa-solid fa-magnifying-glass" />
        </button>
      </div>
    </form>
  );
}
