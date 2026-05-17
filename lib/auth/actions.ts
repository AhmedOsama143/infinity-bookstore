'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { GradeLevel } from '@/lib/types';

export interface AuthResult {
  error?: string;
}

export async function signUpWithEmail(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const next = String(formData.get('next') ?? '/');

  if (!email || !password) return { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' };
  if (password.length < 8) return { error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  if (!fullName) return { error: 'الاسم الكامل مطلوب' };

  // Create the user via the admin API so the account is auto-confirmed —
  // bypasses the project-level "Confirm email" requirement that the dashboard
  // toggle controls. Then immediately sign them in to set the session cookie.
  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr) return { error: translateAuthError(createErr.message) };

  // The on_auth_user_created trigger isn't reliably present on the hosted
  // project, so insert the students row ourselves. ON CONFLICT keeps it idempotent
  // if/when the trigger is reinstalled.
  if (created?.user) {
    await admin
      .from('students')
      .upsert(
        {
          id: created.user.id,
          email,
          full_name: fullName,
          auth_provider: 'email',
        },
        { onConflict: 'id' }
      );
  }

  const supa = await createClient();
  const { error: signInErr } = await supa.auth.signInWithPassword({ email, password });
  if (signInErr) return { error: translateAuthError(signInErr.message) };

  redirect(next);
}

export async function signInWithEmail(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/');

  if (!email || !password) return { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' };

  const supa = await createClient();
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error.message) };

  redirect(next);
}

export async function signOut() {
  const supa = await createClient();
  await supa.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function updateProfile(formData: FormData): Promise<AuthResult> {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: 'يجب تسجيل الدخول أولاً' };

  const full_name = String(formData.get('full_name') ?? '').trim() || null;
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const governorate = String(formData.get('governorate') ?? '').trim() || null;
  const address = String(formData.get('address') ?? '').trim() || null;
  const grade_level = (String(formData.get('grade_level') ?? '') as GradeLevel) || null;

  const { error } = await supa
    .from('students')
    .update({ full_name, phone, governorate, address, grade_level })
    .eq('id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/account');
  return {};
}

export async function completeOnboarding(formData: FormData): Promise<AuthResult> {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: 'يجب تسجيل الدخول أولاً' };

  const full_name = String(formData.get('full_name') ?? '').trim();
  const grade_level = String(formData.get('grade_level') ?? '') as GradeLevel;
  const next = String(formData.get('next') ?? '/');

  if (!full_name) return { error: 'الاسم مطلوب' };
  if (!['first_secondary', 'second_secondary', 'third_secondary'].includes(grade_level)) {
    return { error: 'يرجى اختيار الصف الدراسي' };
  }

  const { error } = await supa
    .from('students')
    .update({ full_name, grade_level })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect(next);
}

// OAuth handled client-side via createBrowserClient. Server-side callback below.

function translateAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'بيانات الدخول غير صحيحة';
  if (lower.includes('user already registered') || lower.includes('already been registered') || lower.includes('already exists')) return 'هذا البريد مسجل من قبل — جرّب تسجيل الدخول';
  if (lower.includes('email not confirmed')) return 'يرجى تأكيد البريد الإلكتروني أولاً';
  if (lower.includes('weak password')) return 'كلمة المرور ضعيفة — استخدم أحرف وأرقام ورموز';
  return msg;
}
