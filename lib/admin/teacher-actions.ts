'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireFullAdmin } from './auth';

interface TeacherPayload {
  id?: number;
  name_ar: string;
  governorate: string | null;
  subject: string | null;
  description: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  is_active: boolean;
  photo_url?: string | null;
}

function parsePayload(formData: FormData, includeId = false): TeacherPayload | string {
  const name_ar = String(formData.get('name_ar') ?? '').trim();
  if (!name_ar) return 'اسم المدرس مطلوب';
  const payload: TeacherPayload = {
    name_ar,
    governorate: String(formData.get('governorate') ?? '').trim() || null,
    subject: String(formData.get('subject') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
    facebook_url: String(formData.get('facebook_url') ?? '').trim() || null,
    youtube_url: String(formData.get('youtube_url') ?? '').trim() || null,
    website_url: String(formData.get('website_url') ?? '').trim() || null,
    is_active: formData.get('is_active') === 'on',
  };
  if (includeId) {
    const id = Number(formData.get('id'));
    if (!Number.isFinite(id)) return 'معرف المدرس مفقود';
    payload.id = id;
  }
  return payload;
}

async function uploadPhoto(formData: FormData, teacherId: number): Promise<string | null> {
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return null;
  // Storage bucket has no INSERT policy for the anon-cookie session; use the
  // service-role client. Safe: createTeacher/updateTeacher are gated by
  // requireFullAdmin() before this runs.
  const supa = createAdminClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `teacher_${teacherId}.${ext}`;
  const { error } = await supa.storage.from('teacher-photos').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  return `${supa.storage.from('teacher-photos').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}

export async function createTeacher(formData: FormData) {
  await requireFullAdmin();
  const parsed = parsePayload(formData);
  if (typeof parsed === 'string') return { error: parsed };

  const supa = await createClient();
  const { data: maxRow } = await supa.from('teachers').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
  const nextId = (maxRow?.id ?? 0) + 1;

  let photo_url: string | null = null;
  try {
    photo_url = await uploadPhoto(formData, nextId);
  } catch (e: any) {
    return { error: 'فشل رفع الصورة: ' + e.message };
  }

  const { error } = await supa.from('teachers').insert({ id: nextId, ...parsed, photo_url });
  if (error) return { error: error.message };

  revalidatePath('/admin/teachers');
  redirect(`/admin/teachers/${nextId}/edit`);
}

export async function updateTeacher(formData: FormData) {
  await requireFullAdmin();
  const parsed = parsePayload(formData, true);
  if (typeof parsed === 'string') return { error: parsed };
  if (!parsed.id) return { error: 'معرف غير موجود' };

  const supa = await createClient();
  let photo_url: string | null = null;
  try {
    photo_url = await uploadPhoto(formData, parsed.id);
  } catch (e: any) {
    return { error: 'فشل رفع الصورة: ' + e.message };
  }

  const update: any = { ...parsed };
  delete update.id;
  if (photo_url) update.photo_url = photo_url;

  const { error } = await supa.from('teachers').update(update).eq('id', parsed.id);
  if (error) return { error: error.message };

  revalidatePath('/admin/teachers');
  revalidatePath(`/admin/teachers/${parsed.id}/edit`);
  revalidatePath(`/teachers/${parsed.id}`);
  return { ok: true };
}
