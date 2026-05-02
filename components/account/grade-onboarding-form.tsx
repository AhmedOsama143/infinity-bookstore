'use client';
import { useState, useTransition } from 'react';
import { completeOnboarding } from '@/lib/auth/actions';
import { gradeLabelAr } from '@/lib/utils';
import type { GradeLevel } from '@/lib/types';

const grades: { value: GradeLevel; emoji: string }[] = [
  { value: 'first_secondary', emoji: '📘' },
  { value: 'second_secondary', emoji: '📗' },
  { value: 'third_secondary', emoji: '📕' },
];

export default function GradeOnboardingForm({
  initialName,
  next,
}: {
  initialName: string;
  next: string;
}) {
  const [name, setName] = useState(initialName);
  const [grade, setGrade] = useState<GradeLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="card p-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!grade) {
          setError('يرجى اختيار الصف الدراسي');
          return;
        }
        const fd = new FormData();
        fd.set('full_name', name.trim());
        fd.set('grade_level', grade);
        fd.set('next', next);
        startTransition(async () => {
          const res = await completeOnboarding(fd);
          if (res?.error) setError(res.error);
        });
      }}
    >
      <div>
        <label className="block text-sm font-semibold mb-2">الاسم الكامل</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-body"
          placeholder="اكتب اسمك"
        />
      </div>

      <div>
        <p className="text-sm font-semibold mb-3">اختر صفك الدراسي</p>
        <div className="grid grid-cols-3 gap-3">
          {grades.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGrade(g.value)}
              className={`p-4 rounded-card border-2 text-center transition-all ${
                grade === g.value
                  ? 'border-primary bg-primary-light'
                  : 'border-[#ddd] hover:border-primary'
              }`}
            >
              <div className="text-3xl mb-1">{g.emoji}</div>
              <div className="text-sm font-bold">{gradeLabelAr[g.value]}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-[#666] mt-2">
          يمكنك تغيير الصف لاحقًا من حسابي
        </p>
      </div>

      {error && (
        <div className="text-sm p-3 rounded-s bg-danger/10 text-danger border border-danger/20">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !grade}
        className="btn btn-primary w-full disabled:opacity-50"
      >
        {isPending ? 'جاري الحفظ...' : 'متابعة'}
      </button>
    </form>
  );
}
