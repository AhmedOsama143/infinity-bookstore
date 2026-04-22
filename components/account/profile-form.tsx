'use client';
import { useState, useTransition } from 'react';
import { updateProfile } from '@/lib/auth/actions';
import { gradeLabelAr } from '@/lib/utils';
import type { GradeLevel } from '@/lib/types';

interface Props {
  initial: {
    full_name: string | null;
    phone: string | null;
    governorate: string | null;
    address: string | null;
    grade_level: GradeLevel | null;
  };
  booksOrderedCount: number;
  cap: number;
}

export default function ProfileForm({ initial, booksOrderedCount, cap }: Props) {
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await updateProfile(formData);
          setMessage(
            res?.error
              ? { type: 'err', text: res.error }
              : { type: 'ok', text: 'تم الحفظ بنجاح ✓' }
          );
        });
      }}
      className="card p-6 space-y-5"
    >
      <div className="flex items-center justify-between pb-4 border-b border-bg-light">
        <div>
          <h2 className="text-xl font-bold text-primary-dark">بياناتي</h2>
          <p className="text-sm text-[#666]">تأكد من صحة البيانات قبل الطلب</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-extrabold text-primary">{booksOrderedCount}/{cap}</div>
          <div className="text-xs text-[#666]">كتاب مطلوب</div>
        </div>
      </div>

      {message && (
        <div className={`text-sm p-3 rounded-s border ${
          message.type === 'ok'
            ? 'bg-success/10 text-success border-success/20'
            : 'bg-danger/10 text-danger border-danger/20'
        }`}>{message.text}</div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">الاسم الكامل</label>
          <input
            name="full_name"
            defaultValue={initial.full_name ?? ''}
            className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-body"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">رقم الموبايل</label>
          <input
            name="phone"
            type="tel"
            defaultValue={initial.phone ?? ''}
            dir="ltr"
            placeholder="01012345678"
            className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-body"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">الصف الدراسي</label>
        <select
          name="grade_level"
          defaultValue={initial.grade_level ?? ''}
          className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-body bg-white"
        >
          <option value="">اختر صفك</option>
          <option value="first_secondary">{gradeLabelAr.first_secondary}</option>
          <option value="second_secondary">{gradeLabelAr.second_secondary}</option>
          <option value="third_secondary">{gradeLabelAr.third_secondary}</option>
        </select>
        <p className="text-xs text-[#666] mt-1">
          نعرض لك الكتب المناسبة لصفك تلقائيًا
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">المحافظة</label>
        <input
          name="governorate"
          defaultValue={initial.governorate ?? ''}
          placeholder="مثل: الإسكندرية"
          className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-body"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">عنوان التوصيل</label>
        <textarea
          name="address"
          defaultValue={initial.address ?? ''}
          rows={3}
          placeholder="العنوان بالتفصيل: المحافظة، المدينة، الشارع، رقم العقار..."
          className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-body resize-y"
        />
      </div>

      <div className="pt-3 border-t border-bg-light">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary px-8 disabled:opacity-50"
        >
          {isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>
    </form>
  );
}
