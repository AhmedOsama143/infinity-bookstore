import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/admin/page-shell';
import ContentEditor from '@/components/admin/content-editor';
import { requireFullAdmin } from '@/lib/admin/auth';

const PAGES = [
  { key: 'about', label: 'من نحن' },
  { key: 'faq', label: 'الأسئلة الشائعة' },
  { key: 'privacy', label: 'سياسة الخصوصية' },
  { key: 'terms', label: 'شروط الاستخدام' },
  { key: 'refund', label: 'سياسة الإرجاع' },
  { key: 'shipping_policy', label: 'سياسة الشحن' },
];

export default async function ContentPage() {
  await requireFullAdmin();
  const supa = await createClient();
  const [{ data: rows }, { data: settings }] = await Promise.all([
    supa.from('site_content').select('key, title_ar, body_ar'),
    supa.from('site_settings').select('announcement_bar_text_ar, announcement_bar_enabled').eq('id', 1).maybeSingle(),
  ]);
  const map = new Map((rows ?? []).map((r) => [r.key, r]));

  const pages = PAGES.map((p) => ({
    key: p.key,
    label: p.label,
    title_ar: map.get(p.key)?.title_ar ?? null,
    body_ar: map.get(p.key)?.body_ar ?? null,
  }));

  return (
    <PageShell title="محتوى الموقع" subtitle="تعديل صفحات من نحن، الأسئلة الشائعة، السياسات، وشريط الإعلان">
      <div className="max-w-4xl">
        <ContentEditor
          pages={pages}
          announcement={{
            text: settings?.announcement_bar_text_ar ?? '',
            enabled: settings?.announcement_bar_enabled ?? true,
          }}
        />
      </div>
    </PageShell>
  );
}
