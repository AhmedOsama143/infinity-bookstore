import type { ShippingAreaType } from '@/lib/types';

export interface ShippingQuote {
  fee: number;
  label: string;
  free_shipping_applied: boolean;
}

export function computeShipping({
  subtotal,
  fulfillment,
  areaType,
  ratePerArea,
  freeShippingThreshold,
  freeShippingEnabled,
}: {
  subtotal: number;
  fulfillment: 'pickup' | 'delivery';
  areaType?: ShippingAreaType | null;
  ratePerArea: Record<ShippingAreaType, number>;
  freeShippingThreshold: number;
  freeShippingEnabled: boolean;
}): ShippingQuote {
  if (fulfillment === 'pickup') {
    return { fee: 0, label: 'استلام من الفرع', free_shipping_applied: false };
  }
  if (!areaType) {
    return { fee: 0, label: 'اختر منطقة التوصيل', free_shipping_applied: false };
  }
  const baseRate = ratePerArea[areaType] ?? 0;
  if (freeShippingEnabled && subtotal >= freeShippingThreshold) {
    return { fee: 0, label: 'شحن مجاني 🎉', free_shipping_applied: true };
  }
  const areaLabel: Record<ShippingAreaType, string> = {
    alexandria_city: 'الإسكندرية',
    alexandria_outskirts: 'ضواحي الإسكندرية',
    kafr_el_dawwar: 'كفر الدوار',
    other_governorate: 'محافظة أخرى',
  };
  return { fee: baseRate, label: areaLabel[areaType], free_shipping_applied: false };
}
