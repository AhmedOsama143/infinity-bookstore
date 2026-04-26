'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { createTeacher, updateTeacher } from '@/lib/admin/teacher-actions';

interface Props {
  mode: 'new' | 'edit';
  initial?: {
    id: number;
    name_ar: string;
    governorate: string | null;
    subject: string | null;
    description: string | null;
    photo_url: string | null;
    facebook_url: string | null;
    youtube_url: string | null;
    website_url: string | null;
    is_active: boolean;
  };
}

export default function TeacherForm({ mode, initial }: Props) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const placeholder =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23dcebe5'/><text x='50%' y='55%' text-anchor='middle' font-size='40' fill='%233c655a' font-family='Cairo'>${initial?.name_ar?.charAt(0) ?? '+'}</text></svg>`
    );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = mode === 'new' ? await createTeacher(fd) : await updateTeacher(fd);
      setMsg(res?.error ? { type: 'err', text: res.error } : { type: 'ok', text: '✓ تم الحفظ' });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      {msg && (
        <div className={`text-sm p-3 rounded-s border ${msg.type === 'ok' ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid md:grid-cols-[160px_1fr] gap-6">
        <div>
          <label className="block text-sm font-semibold mb-2">الصورة</label>
          <div className="w-32 h-32 rounded-full overflow-hidden bg-bg-light shadow-card mb-2 relative">
            <Image
              src={initial?.photo_url ?? placeholder}
              alt="photo"
              fill
              sizes="128px"
              className="object-cover"
              unoptimized={!initial?.photo_url}
            />
          </div>
          <input name="photo" type="file" accept="image/*" className="text-xs w-full" />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">الاسم *</label>
            <input
              name="name_ar"
              required
              defaultValue={initial?.name_ar ?? ''}
              className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">المحافظة</label>
              <input
                name="governorate"
                defaultValue={initial?.governorate ?? ''}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">التخصص</label>
              <input
                name="subject"
                placeholder="مثل: مدرس كيمياء"
                defaultValue={initial?.subject ?? ''}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">نبذة</label>
            <textarea
              name="description"
              rows={4}
              defaultValue={initial?.description ?? ''}
              className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary resize-y"
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <input
              name="facebook_url"
              type="url"
              dir="ltr"
              placeholder="https://facebook.com/..."
              defaultValue={initial?.facebook_url ?? ''}
              className="w-full px-4 py-2 rounded-s border border-[#ddd] focus:outline-none focus:border-primary text-sm"
            />
            <input
              name="youtube_url"
              type="url"
              dir="ltr"
              placeholder="https://youtube.com/..."
              defaultValue={initial?.youtube_url ?? ''}
              className="w-full px-4 py-2 rounded-s border border-[#ddd] focus:outline-none focus:border-primary text-sm"
            />
            <input
              name="website_url"
              type="url"
              dir="ltr"
              placeholder="https://..."
              defaultValue={initial?.website_url ?? ''}
              className="w-full px-4 py-2 rounded-s border border-[#ddd] focus:outline-none focus:border-primary text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="is_active" type="checkbox" defaultChecked={initial?.is_active ?? true} className="w-4 h-4" />
            نشط ومرئي للطلاب
          </label>
        </div>
      </div>

      <button type="submit" disabled={busy} className="btn btn-primary px-10 py-3 disabled:opacity-50">
        {busy ? 'جاري الحفظ...' : mode === 'new' ? 'إضافة المدرس' : 'حفظ التغييرات'}
      </button>
    </form>
  );
}
