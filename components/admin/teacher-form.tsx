'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createTeacher, updateTeacher, deleteTeacher } from '@/lib/admin/teacher-actions';

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
  const router = useRouter();
  const [busy, start] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  function closeConfirm() {
    if (isDeleting) return;
    setConfirmOpen(false);
  }

  function confirmDelete() {
    if (!initial?.id) return;
    setMsg(null);
    startDelete(async () => {
      const res = await deleteTeacher(initial.id!);
      if (res?.error) {
        setConfirmOpen(false);
        setMsg({ type: 'err', text: res.error });
        return;
      }
      if (res?.deactivated) {
        setConfirmOpen(false);
        setMsg({
          type: 'ok',
          text: 'تعذّر حذف المدرس نهائيًا — تم إلغاء تنشيطه وإخفاؤه عن الطلاب.',
        });
        router.refresh();
        return;
      }
      router.push('/admin/teachers');
    });
  }

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [confirmOpen, isDeleting]);

  return (
    <>
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

      <div className="flex gap-3">
        <button type="submit" disabled={busy || isDeleting} className="btn btn-primary px-10 py-3 disabled:opacity-50">
          {busy ? 'جاري الحفظ...' : mode === 'new' ? 'إضافة المدرس' : 'حفظ التغييرات'}
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={() => { setMsg(null); setConfirmOpen(true); }}
            disabled={busy || isDeleting}
            className="btn bg-danger text-white hover:bg-danger/90 px-8 py-3 mr-auto disabled:opacity-50"
          >
            {isDeleting ? 'جاري الحذف...' : 'حذف المدرس'}
          </button>
        )}
      </div>
    </form>

    {confirmOpen && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-teacher-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm"
        onClick={closeConfirm}
      >
        <div
          className="card w-full max-w-md shadow-card-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-5 bg-primary-light">
            <h3 id="delete-teacher-title" className="font-bold text-primary-dark flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-danger" />
              تأكيد حذف المدرس
            </h3>
            <button
              type="button"
              onClick={closeConfirm}
              disabled={isDeleting}
              aria-label="إغلاق"
              className="text-primary-dark/70 hover:text-primary-dark disabled:opacity-50"
            >
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          </div>

          <div className="p-5">
            <p className="text-sm text-ink leading-relaxed">
              هل أنت متأكد من حذف المدرس{' '}
              <span className="font-bold">«{initial?.name_ar}»</span> نهائيًا؟
            </p>
            <p className="text-xs text-[#666] mt-2 leading-relaxed">
              لا يمكن التراجع عن هذا الإجراء. كتب هذا المدرس لن تُحذف، لكنها ستصبح بدون مدرس.
            </p>
          </div>

          <div className="flex flex-wrap-reverse justify-end gap-3 p-5 bg-bg-light/50 border-t border-bg-light">
            <button
              type="button"
              onClick={closeConfirm}
              disabled={isDeleting}
              className="btn bg-white text-ink hover:bg-bg-light px-5 py-2 text-sm disabled:opacity-50"
            >
              تراجع
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="btn bg-danger text-white hover:bg-danger/90 px-5 py-2 text-sm font-bold disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin ml-2" />
                  جاري الحذف…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-trash ml-2" />
                  حذف نهائي
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
