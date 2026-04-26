import type { OrderStatus } from '@/lib/types';

const map: Record<OrderStatus, { bg: string; label: string }> = {
  pending:    { bg: 'bg-primary-light text-primary-dark', label: 'قيد المراجعة' },
  confirmed:  { bg: 'bg-accent text-white',                label: 'مؤكد' },
  ready:      { bg: 'bg-success text-white',               label: 'جاهز للاستلام' },
  completed:  { bg: 'bg-success text-white',               label: 'مكتمل' },
  cancelled:  { bg: 'bg-danger text-white',                label: 'ملغي' },
};

export default function StatusPill({ status }: { status: OrderStatus }) {
  const m = map[status];
  return <span className={`${m.bg} px-2.5 py-1 rounded-pill text-xs font-bold whitespace-nowrap`}>{m.label}</span>;
}
