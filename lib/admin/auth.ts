import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AdminRole } from './types';

export interface AdminContext {
  userId: string;
  email: string | null;
  role: AdminRole;
  branchId: string | null;
}

/** Server-side guard for /admin/** routes. */
export async function requireAdmin(): Promise<AdminContext> {
  // Identity is established with the user-scoped client (cookie auth).
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  // Role lookup uses the service-role client so the check doesn't depend on
  // admin_users RLS being permissive enough for self-reads. A future
  // tightening of that RLS policy would otherwise silently lock out every
  // admin. We're only fetching THIS user's row by id, so the elevated
  // privilege is scoped tightly.
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('admin_users')
    .select('role, branch_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!row) {
    redirect('/');
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: row.role as AdminRole,
    branchId: row.branch_id ?? null,
  };
}

export async function requireFullAdmin(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (ctx.role !== 'admin') redirect('/admin');
  return ctx;
}
