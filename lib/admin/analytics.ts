import { createClient } from '@/lib/supabase/server';

export type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';
export type Granularity = 'daily' | 'weekly' | 'monthly';

export function resolveRange(preset: DateRangePreset, fromIso?: string, toIso?: string): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'today':
      return { from: startOfDay, to: endOfDay };
    case 'yesterday': {
      const y = new Date(startOfDay); y.setDate(y.getDate() - 1);
      const ye = new Date(endOfDay); ye.setDate(ye.getDate() - 1);
      return { from: y, to: ye };
    }
    case 'this_week': {
      const day = startOfDay.getDay(); // 0=Sun
      const from = new Date(startOfDay); from.setDate(from.getDate() - day);
      return { from, to: endOfDay };
    }
    case 'last_week': {
      const day = startOfDay.getDay();
      const from = new Date(startOfDay); from.setDate(from.getDate() - day - 7);
      const to = new Date(from); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case 'this_month': {
      const from = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
      return { from, to: endOfDay };
    }
    case 'last_month': {
      const from = new Date(startOfDay.getFullYear(), startOfDay.getMonth() - 1, 1);
      const to = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case 'custom':
      return {
        from: fromIso ? new Date(fromIso) : startOfDay,
        to: toIso ? new Date(toIso) : endOfDay,
      };
  }
}

export function bucketKey(date: Date, granularity: Granularity): string {
  if (granularity === 'monthly') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  if (granularity === 'weekly') {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());          // start of week (Sunday)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
