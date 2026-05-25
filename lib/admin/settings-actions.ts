'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireFullAdmin } from './auth';
import { translateDbError } from './errors';

export async function setMfaEnabled(enabled: boolean) {
  const ctx = await requireFullAdmin();
  const supa = await createClient();
  await supa.from('admin_users').update({ mfa_enabled: enabled }).eq('id', ctx.userId);
  revalidatePath('/admin/settings');
  return { ok: true };
}

export interface InviteResult {
  error?: string;
  ok?: { email: string; tempPassword: string };
}

// Creates a branch_manager account scoped to one branch.
// Returns a temporary password the admin can share with the manager;
// the manager should change it on first login.
export async function inviteBranchManager(formData: FormData): Promise<InviteResult> {
  const ctx = await requireFullAdmin();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const branch_id = String(formData.get('branch_id') ?? '').trim();
  if (!email || !branch_id) return { error: 'البريد والفرع مطلوبان' };

  // Random 12-char password the admin shares once.
  const tempPassword = Array.from(
    crypto.getRandomValues(new Uint8Array(9)),
    (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]
  ).join('');

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: 'branch_manager' },
  });
  if (error) return { error: translateDbError({ message: error.message, code: null }, 'admin/settings', 'invite_create_user_failed') };
  if (!created.user) return { error: 'تعذّر إنشاء الحساب' };

  const { error: insErr } = await admin.from('admin_users').insert({
    id: created.user.id,
    role: 'branch_manager',
    branch_id,
    mfa_enabled: false,
  });
  if (insErr) {
    // Roll back the auth user so we don't leave orphans.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: insErr.message };
  }

  await admin.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'invite',
    entity_type: 'admin_user',
    entity_id: created.user.id,
    diff: { email, branch_id, role: 'branch_manager' },
  });

  revalidatePath('/admin/settings');
  return { ok: { email, tempPassword } };
}

export async function removeBranchManager(userId: string) {
  const ctx = await requireFullAdmin();
  const admin = createAdminClient();

  // Snapshot what we're deleting so the audit row keeps meaningful info
  // after the row is gone.
  const { data: snapshot } = await admin
    .from('admin_users')
    .select('role, branch_id')
    .eq('id', userId)
    .maybeSingle();

  await admin.from('admin_users').delete().eq('id', userId).eq('role', 'branch_manager');
  await admin.auth.admin.deleteUser(userId);

  await admin.from('audit_log').insert({
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'remove',
    entity_type: 'admin_user',
    entity_id: userId,
    diff: snapshot ?? null,
  });

  revalidatePath('/admin/settings');
  return { ok: true };
}
