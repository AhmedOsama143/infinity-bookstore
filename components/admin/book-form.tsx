'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { createBook, updateBook } from '@/lib/admin/book-actions';
import { fallbackCover, gradeLabelAr, bookTypeLabelAr } from '@/lib/utils';
import type { GradeLevel, BookType } from '@/lib/types';

interface Props {
  mode: 'new' | 'edit';
  initial?: {
    id: number;
    title_ar: string;
    teacher_id: number | null;
    grade_level: GradeLevel;
    book_type: BookType;
    description: string | null;
    price: number;
    discount_pct: number;
    weight_grams: number | null;
    publish_year: number | null;
    isbn: string | null;
    is_active: boolean;
    cover_url: string | null;
  };
  teachers: { id: number; name_ar: string }[];
  branches: { id: string; name_ar: string }[];
  branchStock: Record<string, number>; // branch_id → quantity
}

export default function BookForm({ mode, initial, teachers, branches, branchStock }: Props) {
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = mode === 'new' ? await createBook(fd) : await updateBook(fd);
      setMsg(res?.error ? { type: 'err', text: res.error } : { type: 'ok', text: '✓ تم الحفظ' });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-4xl">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      {msg && (
        <div className={`text-sm p-3 rounded-s border ${msg.type === 'ok' ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid md:grid-cols-[200px_1fr] gap-6">
        {/* Cover */}
        <div>
          <label className="block text-sm font-semibold mb-2">الغلاف</label>
          <div className="relative aspect-[3/4] rounded-card overflow-hidden bg-bg-light shadow-card mb-2">
            <Image
              src={initial?.cover_url ?? fallbackCover(initial?.title_ar ?? 'كتاب جديد')}
              alt="cover"
              fill
              sizes="200px"
              className="object-cover"
              unoptimized={!initial?.cover_url}
            />
          </div>
          <input
            name="cover"
            type="file"
            accept="image/*"
            className="text-xs w-full"
          />
          <p className="text-[10px] text-[#888] mt-1">JPG/PNG، يحل محل الصورة الحالية</p>
        </div>

        {/* Main fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">عنوان الكتاب *</label>
            <input
              name="title_ar"
              required
              defaultValue={initial?.title_ar ?? ''}
              className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">المدرس</label>
              <select
                name="teacher_id"
                defaultValue={initial?.teacher_id ?? ''}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary bg-white"
              >
                <option value="">— بدون —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name_ar}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">الصف *</label>
              <select
                name="grade_level"
                required
                defaultValue={initial?.grade_level ?? 'third_secondary'}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary bg-white"
              >
                <option value="first_secondary">{gradeLabelAr.first_secondary}</option>
                <option value="second_secondary">{gradeLabelAr.second_secondary}</option>
                <option value="third_secondary">{gradeLabelAr.third_secondary}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">السعر *</label>
              <div className="relative">
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={initial?.price ?? 0}
                  className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#888]">ج</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">الخصم %</label>
              <input
                name="discount_pct"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={initial?.discount_pct ?? 0}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">النوع</label>
              <select
                name="book_type"
                defaultValue={initial?.book_type ?? 'external_ar'}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary bg-white"
              >
                <option value="external_ar">{bookTypeLabelAr.external_ar}</option>
                <option value="online_ar">{bookTypeLabelAr.online_ar}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">الوصف</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={initial?.description ?? ''}
              className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary resize-y"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">الوزن (جم)</label>
              <input
                name="weight_grams"
                type="number"
                min="0"
                defaultValue={initial?.weight_grams ?? ''}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">سنة النشر</label>
              <input
                name="publish_year"
                type="number"
                min="2000"
                max="2050"
                defaultValue={initial?.publish_year ?? ''}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">ISBN</label>
              <input
                name="isbn"
                defaultValue={initial?.isbn ?? ''}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input name="is_active" type="checkbox" defaultChecked={initial?.is_active ?? true} className="w-4 h-4" />
            الكتاب نشط ومرئي للطلاب
          </label>
        </div>
      </div>

      {/* Per-branch stock */}
      <div className="card p-5">
        <h3 className="font-bold text-primary-dark mb-3">المخزون لكل فرع</h3>
        <p className="text-xs text-[#666] mb-4">عدد النسخ المتاحة فعليًا في كل فرع. تغيير هذه الأرقام يحدث الموقع فورًا.</p>
        <div className="grid md:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div key={b.id}>
              <label className="block text-sm font-semibold mb-1">{b.name_ar}</label>
              <input
                name={`stock_${b.id}`}
                type="number"
                min="0"
                step="1"
                defaultValue={branchStock[b.id] ?? 0}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary px-10 py-3 disabled:opacity-50"
        >
          {isPending ? 'جاري الحفظ...' : mode === 'new' ? 'إضافة الكتاب' : 'حفظ التغييرات'}
        </button>
      </div>
    </form>
  );
}
