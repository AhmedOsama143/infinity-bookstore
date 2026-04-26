'use client';

import { useState, useTransition } from 'react';
import { updateSiteContent, updateAnnouncementBar } from '@/lib/admin/content-actions';

interface Page {
  key: string;
  title_ar: string | null;
  body_ar: string | null;
  label: string;
}

export default function ContentEditor({
  pages,
  announcement,
}: {
  pages: Page[];
  announcement: { text: string; enabled: boolean };
}) {
  const [active, setActive] = useState(pages[0]?.key ?? '');
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function saveContent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateSiteContent(fd);
      setMsg(res?.error ? { type: 'err', text: res.error } : { type: 'ok', text: '✓ تم الحفظ — التغيير ظاهر فورًا على الموقع' });
    });
  }

  function saveAnnouncement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateAnnouncementBar(fd);
      setMsg(res?.error ? { type: 'err', text: res.error } : { type: 'ok', text: '✓ تم تحديث شريط الإعلان' });
    });
  }

  const current = pages.find((p) => p.key === active) ?? pages[0];

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`text-sm p-3 rounded-s border ${msg.type === 'ok' ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
          {msg.text}
        </div>
      )}

      {/* Announcement bar editor */}
      <form onSubmit={saveAnnouncement} className="card p-5">
        <h2 className="font-bold text-primary-dark mb-3">شريط الإعلان أعلى الموقع</h2>
        <textarea
          name="text"
          rows={2}
          defaultValue={announcement.text}
          className="w-full px-4 py-2 rounded-s border border-[#ddd] focus:border-primary outline-none mb-3"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input name="enabled" type="checkbox" defaultChecked={announcement.enabled} className="w-4 h-4" />
            مُفعّل
          </label>
          <button type="submit" disabled={busy} className="btn btn-primary px-6 py-1.5 text-sm disabled:opacity-50">
            حفظ
          </button>
        </div>
      </form>

      {/* Static page editor */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-bg-light overflow-x-auto bg-bg-light">
          {pages.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setActive(p.key)}
              className={`px-5 py-3 text-sm font-bold whitespace-nowrap ${active === p.key ? 'bg-white text-primary border-b-2 border-accent' : 'text-ink hover:bg-white/50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {current && (
          <form onSubmit={saveContent} className="p-5 space-y-4" key={current.key}>
            <input type="hidden" name="key" value={current.key} />
            <div>
              <label className="block text-sm font-semibold mb-1">العنوان</label>
              <input
                name="title_ar"
                defaultValue={current.title_ar ?? ''}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">المحتوى</label>
              <textarea
                name="body_ar"
                rows={14}
                defaultValue={current.body_ar ?? ''}
                placeholder="اكتب المحتوى هنا..."
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:border-primary outline-none resize-y font-body leading-loose"
              />
              <p className="text-xs text-[#666] mt-2">يدعم الأسطر الجديدة. يظهر مباشرة على صفحة /{current.key}</p>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary px-8 py-2 disabled:opacity-50">
              {busy ? 'جاري الحفظ...' : 'حفظ المحتوى'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
