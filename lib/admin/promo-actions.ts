'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireFullAdmin } from './auth';

export async function savePromoCode(formData: FormData) {
  await requireFullAdmin();
  const supa = await createClient();

  const id = String(formData.get('id') ?? '') || null;
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const discount_type = String(formData.get('discount_type') ?? 'percentage');
  const discount_value = Number(formData.get('discount_value') ?? 0);
  const validFrom = String(formData.get('valid_from') ?? '');
  const validTo = String(formData.get('valid_to') ?? '');
  const usage_limit = formData.get('usage_limit') ? Number(formData.get('usage_limit')) : null;
  const is_active = formData.get('is_active') === 'on';

  if (!code) return { error: 'كود مطلوب' };
  if (!Number.isFinite(discount_value) || discount_value < 0) return { error: 'قيمة خصم غير صحيحة' };
  if (discount_type === 'percentage' && discount_value > 100) return { error: 'النسبة يجب ألا تتجاوز 100%' };

  const payload = {
    code,
    discount_type,
    discount_value,
    valid_from: validFrom ? new Date(validFrom).toISOString() : null,
    valid_to: validTo ? new Date(validTo).toISOString() : null,
    usage_limit,
    is_active,
  };

  if (id) {
    const { error } = await supa.from('promo_codes').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supa.from('promo_codes').insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath('/admin/promos');
  redirect('/admin/promos');
}

export async function togglePromoActive(id: string, active: boolean) {
  await requireFullAdmin();
  const supa = await createClient();
  await supa.from('promo_codes').update({ is_active: active }).eq('id', id);
  revalidatePath('/admin/promos');
}
