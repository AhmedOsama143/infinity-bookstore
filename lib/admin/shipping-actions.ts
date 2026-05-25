'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireFullAdmin } from './auth';
import { translateDbError } from './errors';

export async function updateShippingRate(formData: FormData) {
  await requireFullAdmin();
  const id = String(formData.get('id') ?? '');
  const price = Number(formData.get('price') ?? 0);
  if (!id || !Number.isFinite(price) || price < 0) return { error: 'بيانات غير صحيحة' };

  const supa = await createClient();
  const { error } = await supa.from('shipping_rates').update({ price }).eq('id', id);
  if (error) return { error: translateDbError(error, 'admin/shipping', 'rate_update_failed', { id }) };
  revalidatePath('/admin/shipping');
  return { ok: true };
}

export async function updateFreeShippingThreshold(formData: FormData) {
  await requireFullAdmin();
  const threshold = Number(formData.get('threshold') ?? 0);
  const enabled = formData.get('enabled') === 'on';
  if (!Number.isFinite(threshold) || threshold < 0) return { error: 'قيمة غير صحيحة' };

  const supa = await createClient();
  const { error } = await supa
    .from('site_settings')
    .update({ free_shipping_threshold: threshold, free_shipping_enabled: enabled })
    .eq('id', 1);
  if (error) return { error: translateDbError(error, 'admin/shipping', 'threshold_update_failed') };
  revalidatePath('/admin/shipping');
  revalidatePath('/', 'layout');
  return { ok: true };
}
