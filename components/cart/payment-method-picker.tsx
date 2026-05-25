'use client';

import type { ReactNode } from 'react';
import type { FawryPaymentMethod } from '@/lib/fawry/types';

/**
 * Five payment methods, ordered to match the storefront reference design:
 *   1. COD — existing storefront flow (placeOrder server action)
 *   2. PayAtFawry  — pay at any Fawry kiosk against a reference number
 *   3. CARD (relabelled as "بطاقة فوري") — Fawry's branded card flow
 *   4. MWALLET — push notification to ماي فوري
 *   5. CARD — Visa/Mastercard
 *
 * Tiles 3 and 5 both send paymentMethod='CARD' to Fawry. The labels differ
 * because Fawry's popup picks the right sub-flow based on the card the user
 * enters; we surface both entry points so customers find the one they recognise.
 */
export type PaymentChoice =
  | { kind: 'cod' }
  | { kind: 'fawry'; method: FawryPaymentMethod; tile: 'pay_at_fawry' | 'fawry_card' | 'mwallet' | 'card' };

interface Props {
  selected: PaymentChoice;
  onSelect: (choice: PaymentChoice) => void;
  disabled?: boolean;
}

interface Tile {
  id: 'cod' | 'pay_at_fawry' | 'fawry_card' | 'mwallet' | 'card';
  label: string;
  hint?: string;
  icon: ReactNode;
  choice: PaymentChoice;
}

const TILES: Tile[] = [
  {
    id: 'cod',
    label: 'كاش عند الاستلام',
    hint: 'الدفع عند استلام الطلب',
    icon: <i className="fa-solid fa-money-bill-wave text-2xl text-success" aria-hidden />,
    choice: { kind: 'cod' },
  },
  {
    id: 'pay_at_fawry',
    label: 'الرقم المرجعي',
    hint: 'احصل على رقم مرجعي وادفع في أي منفذ فوري',
    icon: <i className="fa-solid fa-receipt text-2xl text-accent-dark" aria-hidden />,
    choice: { kind: 'fawry', method: 'PayAtFawry', tile: 'pay_at_fawry' },
  },
  {
    id: 'fawry_card',
    label: 'بطاقة فوري',
    hint: 'الدفع باستخدام بطاقة فوري',
    icon: <i className="fa-solid fa-credit-card text-2xl text-accent-dark" aria-hidden />,
    choice: { kind: 'fawry', method: 'CARD', tile: 'fawry_card' },
  },
  {
    id: 'mwallet',
    label: 'الدفع بواسطة ماي فوري',
    hint: 'إشعار دفع على تطبيق ماي فوري',
    icon: <i className="fa-solid fa-mobile-screen text-2xl text-primary" aria-hidden />,
    choice: { kind: 'fawry', method: 'MWALLET', tile: 'mwallet' },
  },
  {
    id: 'card',
    label: 'بطاقة الدفع أو بطاقة الخصم',
    hint: 'Visa / Mastercard / Meeza',
    icon: <i className="fa-brands fa-cc-visa text-2xl text-primary" aria-hidden />,
    choice: { kind: 'fawry', method: 'CARD', tile: 'card' },
  },
];

function isSelected(selected: PaymentChoice, tileId: Tile['id']): boolean {
  if (selected.kind === 'cod') return tileId === 'cod';
  return tileId === selected.tile;
}

export default function PaymentMethodPicker({ selected, onSelect, disabled }: Props) {
  return (
    <div className="card p-6">
      <h3 className="font-bold text-primary-dark mb-4">طرق الدفع</h3>
      <div className="space-y-2">
        {TILES.map((t) => {
          const active = isSelected(selected, t.id);
          const isFawry = t.choice.kind === 'fawry';
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => !disabled && onSelect(t.choice)}
              disabled={disabled}
              aria-pressed={active}
              className={`w-full flex items-center gap-4 rounded-s border-2 p-4 text-right transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                active
                  ? 'border-primary bg-primary-light'
                  : 'border-[#ddd] hover:border-primary/50'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  active ? 'border-primary' : 'border-[#bbb]'
                }`}
              >
                {active && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold">{t.label}</div>
                {t.hint && <div className="text-xs text-[#666] mt-0.5">{t.hint}</div>}
                {isFawry && (
                  <div className="text-[0.68rem] text-accent-dark mt-1.5 flex items-center gap-1">
                    <i className="fa-solid fa-circle-info" />
                    تطبق رسوم بنكية بسيطة من فوري
                  </div>
                )}
              </div>
              <span className="flex-shrink-0">{t.icon}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
