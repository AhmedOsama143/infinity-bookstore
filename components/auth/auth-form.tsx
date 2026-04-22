'use client';
import { useState, useTransition } from 'react';

interface Props {
  action: (formData: FormData) => Promise<{ error?: string }>;
  mode: 'login' | 'register';
  next: string;
}

export default function AuthForm({ action, mode, next }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);
        formData.set('next', next);
        startTransition(async () => {
          const res = await action(formData);
          if (res?.error) setError(res.error);
        });
      }}
      className="space-y-4"
    >
      {error && (
        <div className="bg-danger/10 text-danger text-sm p-3 rounded-s border border-danger/20">
          {error}
        </div>
      )}

      {mode === 'register' && (
        <div>
          <label className="block text-sm font-semibold mb-1">الاسم الكامل</label>
          <input
            name="full_name"
            required
            autoComplete="name"
            className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-body"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold mb-1">البريد الإلكتروني</label>
        <input
          name="email"
          type="email"
          required
          autoComplete={mode === 'login' ? 'email' : 'email'}
          className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-body"
          dir="ltr"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">كلمة المرور</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary font-body"
        />
        {mode === 'register' && (
          <p className="text-xs text-[#666] mt-1">٨ أحرف على الأقل</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary w-full py-3 text-base disabled:opacity-50"
      >
        {isPending
          ? 'جارٍ التنفيذ...'
          : mode === 'login'
            ? 'تسجيل الدخول'
            : 'إنشاء الحساب'}
      </button>
    </form>
  );
}
