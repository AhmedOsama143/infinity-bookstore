import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AdminRole } from './types';

export interface AdminContext {
  userId: string;
  email: string | null;
  role: AdminRole;
  branchId: string | null;
}

/** Server-side guard for /admin/** routes. */
export async function requireAdmin(): Promise<AdminContext> {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const { data: admin } = await supa
    .from('admin_users')
    .select('role, branch_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!admin) {
    redirect('/');
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: admin.role as AdminRole,
    branchId: admin.branch_id ?? null,
  };
}

export async function requireFullAdmin(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (ctx.role !== 'admin') redirect('/admin');
  return ctx;
}
