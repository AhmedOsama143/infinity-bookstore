'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireFullAdmin } from './auth';
import { translateDbError } from './errors';

export async function updateSiteContent(formData: FormData) {
  await requireFullAdmin();
  const key = String(formData.get('key') ?? '');
  const title_ar = String(formData.get('title_ar') ?? '').trim();
  const body_ar = String(formData.get('body_ar') ?? '').trim();
  if (!key) return { error: 'مفتاح المحتوى مفقود' };

  const supa = await createClient();
  const { error } = await supa.from('site_content').upsert(
    { key, title_ar, body_ar },
    { onConflict: 'key' }
  );
  if (error) return { error: translateDbError(error, 'admin/content', 'upsert_failed', { key }) };

  revalidatePath('/admin/content');
  // Revalidate the public page that displays this content
  if (key === 'about') revalidatePath('/about');
  else if (key === 'faq') revalidatePath('/faq');
  else revalidatePath(`/legal/${key}`);
  return { ok: true };
}

export async function updateAnnouncementBar(formData: FormData) {
  await requireFullAdmin();
  const text = String(formData.get('text') ?? '').trim();
  const enabled = formData.get('enabled') === 'on';
  const supa = await createClient();
  const { error } = await supa
    .from('site_settings')
    .update({ announcement_bar_text_ar: text, announcement_bar_enabled: enabled })
    .eq('id', 1);
  if (error) return { error: translateDbError(error, 'admin/content', 'announcement_update_failed') };
  revalidatePath('/', 'layout');
  return { ok: true };
}
