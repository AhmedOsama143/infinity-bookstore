'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from './cart-provider';
import { formatPrice } from '@/lib/utils';
import { computeShipping } from '@/lib/cart/shipping';
import { placeOrder } from '@/lib/cart/order-actions';
import { checkCartAvailability, type BranchAvailability } from '@/lib/data/cart-lookups';
import { revalidateCart } from '@/lib/stock/integrity';
import type { ShippingAreaType } from '@/lib/types';
import PaymentMethodPicker, { type PaymentChoice } from './payment-method-picker';
import { useFawryScript } from '@/lib/fawry/use-fawry-script';
import type { FawryChargeRequest } from '@/lib/fawry/types';
import { trackAddPaymentInfo, trackBeginCheckout } from '@/lib/analytics/gtm';

interface BranchOption {
  id: string;
  slug: string;
  name_ar: string;
  city: string;
  address_ar: string;
}

interface Props {
  branches: BranchOption[];
  shippingRates: Record<ShippingAreaType, number>;
  freeShippingThreshold: number;
  freeShippingEnabled: boolean;
  cap: number;
  alreadyOrdered: number;
  student: { full_name: string; phone: string; governorate: string; address: string };
  fawryJsUrl: string;
  fawryCssUrl: string;
}

const AREA_OPTIONS: { value: ShippingAreaType; label: string }[] = [
  { value: 'alexandria_city', label: 'الإسكندرية (داخل المدينة)' },
  { value: 'alexandria_outskirts', label: 'ضواحي الإسكندرية' },
  { value: 'kafr_el_dawwar', label: 'كفر الدوار' },
  { value: 'other_governorate', label: 'محافظة أخرى' },
];

export default function CheckoutView({
  branches,
  shippingRates,
  freeShippingThreshold,
  freeShippingEnabled,
  cap,
  alreadyOrdered,
  student,
  fawryJsUrl,
  fawryCssUrl,
}: Props) {
  const router = useRouter();
  const { items, subtotal, totalItems, clear, setQuantity, remove, isHydrated } = useCart();

  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [branchId, setBranchId] = useState<string>('');
  const [areaType, setAreaType] = useState<ShippingAreaType | ''>('');
  const [governorate, setGovernorate] = useState(student.governorate);
  const [address, setAddress] = useState(student.address);
  const [fullName, setFullName] = useState(student.full_name);
  const [phone, setPhone] = useState(student.phone);
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState<BranchAvailability[]>([]);
  const [isSubmitting, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stockNotices, setStockNotices] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const revalidatedOnce = useRef(false);

  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>({ kind: 'cod' });
  const fawryReady = useFawryScript(fawryJsUrl, fawryCssUrl);
  const beginCheckoutFired = useRef(false);
  // Stable per-checkout-attempt key. Retries within this session reuse the
  // same order rather than racing two pending orders against the same cart.
  const idempotencyKey = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  // Fire begin_checkout once per visit, after hydration and only when there's
  // a real cart. Skip when revalidation later empties the cart — those users
  // never actually got to "begin checkout" semantically.
  useEffect(() => {
    if (!isHydrated) return;
    if (beginCheckoutFired.current) return;
    if (items.length === 0) return;
    beginCheckoutFired.current = true;
    trackBeginCheckout(items, subtotal);
  }, [isHydrated, items, subtotal]);

  // Pre-checkout integrity pass: catch sold-out / delisted books before
  // the user picks a branch. Adjusts or removes lines and forces an explicit
  // ack so we never silently advance them to place-order.
  useEffect(() => {
    if (!isHydrated) return;
    if (revalidatedOnce.current) return;
    if (items.length === 0) {
      revalidatedOnce.current = true;
      return;
    }
    revalidatedOnce.current = true;
    const snapshot = items.map((i) => ({ book_id: i.book_id, quantity: i.quantity, title_ar: i.title_ar }));
    revalidateCart(
      snapshot.map((s) => ({ book_id: s.book_id, quantity: s.quantity })),
      'checkout_entry'
    )
      .then((decisions) => {
        const messages: string[] = [];
        for (const { book_id, decision } of decisions) {
          if (decision.decision === 'allow') continue;
          if (decision.decision === 'block') {
            remove(book_id);
            messages.push(decision.user_message ?? `كتاب لم يعد متاحًا — تمت إزالته.`);
          } else if (decision.decision === 'adjust') {
            setQuantity(book_id, decision.final_qty);
            messages.push(decision.user_message ?? `تم تعديل الكمية حسب المتاح.`);
          }
        }
        if (messages.length > 0) setStockNotices(messages);
      })
      .catch(() => {});
  }, [isHydrated, items, remove, setQuantity]);

  // Check branch availability whenever items change
  useEffect(() => {
    if (items.length === 0) return;
    checkCartAvailability(items.map((i) => ({ book_id: i.book_id, quantity: i.quantity })))
      .then(setAvailability)
      .catch(() => setAvailability([]));
  }, [items]);

  // Auto-select first fulfilling branch when availability loads
  useEffect(() => {
    if (branchId) return;
    const firstOk = availability.find((a) => a.can_fulfill);
    if (firstOk) setBranchId(firstOk.branch_id);
  }, [availability, branchId]);

  const quote = useMemo(
    () =>
      computeShipping({
        subtotal,
        fulfillment,
        areaType: areaType || null,
        ratePerArea: shippingRates,
        freeShippingThreshold,
        freeShippingEnabled,
      }),
    [subtotal, fulfillment, areaType, shippingRates, freeShippingThreshold, freeShippingEnabled]
  );
  const total = subtotal + quote.fee;

  const wouldExceedCap = alreadyOrdered + totalItems > cap;
  const stockChanged = stockNotices.length > 0;
  const isFawry = paymentChoice.kind === 'fawry';
  const canSubmit =
    !wouldExceedCap &&
    isHydrated &&
    items.length > 0 &&
    !!branchId &&
    (fulfillment === 'pickup' || (areaType && governorate && address)) &&
    !!fullName &&
    !!phone &&
    (!stockChanged || acknowledged) &&
    (!isFawry || fawryReady);

  const selectedBranchAvail = availability.find((a) => a.branch_id === branchId);

  async function handleFawryCheckout(method: Extract<PaymentChoice, { kind: 'fawry' }>['method']) {
    if (typeof window === 'undefined' || !window.FawryPay) {
      setSubmitError('فشل تحميل بوابة فوري. حدّث الصفحة وحاول مرة أخرى.');
      return;
    }

    // 1. Create the pending order. Idempotency-Key locks retries within this
    //    session to the same order so a double-click doesn't double-reserve.
    const createRes = await fetch('/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey.current,
      },
      body: JSON.stringify({
        items: items.map((i) => ({ book_id: i.book_id, quantity: i.quantity })),
        branch_id: branchId,
        fulfillment,
        shipping:
          fulfillment === 'delivery'
            ? { governorate, address, area_type: areaType }
            : undefined,
        notes: notes || undefined,
      }),
    });
    const createJson = await createRes.json().catch(() => null);
    if (!createRes.ok || !createJson?.ok) {
      setSubmitError(createJson?.error?.message ?? 'فشل إنشاء الطلب');
      return;
    }
    const orderId: string = createJson.data.orderId;

    // 2. Get the signed Fawry payload for this order + chosen sub-method.
    const chargeRes = await fetch('/api/fawry/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, payment_method: method }),
    });
    const chargeJson = await chargeRes.json().catch(() => null);
    if (!chargeRes.ok || !chargeJson?.ok) {
      setSubmitError(chargeJson?.error?.message ?? 'فشل تجهيز عملية الدفع');
      return;
    }
    const payload: FawryChargeRequest = chargeJson.data;

    // 3. Hand off to the Fawry plugin. It will redirect on completion to the
    //    returnUrl baked into the payload (/checkout/result?orderId=...).
    //    We deliberately don't clear the cart here — the user might cancel
    //    inside the popup, in which case we want them back on this page with
    //    items intact. The result page clears on confirmed PAID.
    window.FawryPay.checkout(payload, { locale: 'ar', mode: 'POPUP' });
  }

  function handleSubmit() {
    setSubmitError(null);
    const paymentType =
      paymentChoice.kind === 'cod' ? 'cod' : `fawry_${paymentChoice.tile}`;
    trackAddPaymentInfo(items, subtotal, paymentType);
    if (paymentChoice.kind === 'cod') {
      startTransition(async () => {
        const res = await placeOrder({
          items,
          fulfillment,
          branch_id: branchId,
          shipping_governorate: fulfillment === 'delivery' ? governorate : undefined,
          shipping_address: fulfillment === 'delivery' ? address : undefined,
          shipping_area_type: fulfillment === 'delivery' ? (areaType as ShippingAreaType) : undefined,
          notes: notes || undefined,
        });
        if (res.error) {
          setSubmitError(res.error);
          return;
        }
        clear();
        router.push(`/orders/${res.order_id}/success`);
      });
      return;
    }
    // Fawry path — runs outside startTransition because the Fawry plugin
    // navigates the page itself; we don't want the transition to keep the
    // button stuck in pending state if the user cancels inside the popup.
    startTransition(async () => {
      await handleFawryCheckout(paymentChoice.method);
    });
  }

  if (!isHydrated) {
    return <div className="text-center py-16 text-[#666]"><i className="fa-solid fa-spinner fa-spin text-2xl" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <h2 className="text-xl font-bold mb-3">السلة فارغة</h2>
        <Link href="/books" className="btn btn-primary">تصفح الكتب</Link>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">
      <div className="space-y-6">
        {stockChanged && !acknowledged && (
          <div className="card border border-accent/40 bg-accent/5 p-4">
            <h3 className="font-bold text-primary-dark mb-2">
              <i className="fa-solid fa-circle-info ml-1 text-accent-dark" />
              تم تحديث السلة قبل المتابعة
            </h3>
            <ul className="text-sm space-y-1 mb-3 text-ink/80">
              {stockNotices.map((msg, i) => (
                <li key={i}>• {msg}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setAcknowledged(true)}
              className="btn btn-primary text-sm py-2 px-5"
            >
              فهمت — متابعة الدفع
            </button>
          </div>
        )}

        {/* Fulfillment */}
        <div className="card p-6">
          <h3 className="font-bold text-primary-dark mb-4">طريقة الاستلام</h3>
          <div className="grid grid-cols-2 gap-3">
            {(['pickup', 'delivery'] as const).map((opt) => {
              const active = fulfillment === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFulfillment(opt)}
                  className={`rounded-card border-2 p-4 text-center transition-colors ${
                    active ? 'border-primary bg-primary-light' : 'border-[#ddd] hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-1">{opt === 'pickup' ? '🏪' : '🚚'}</div>
                  <div className="font-bold">{opt === 'pickup' ? 'استلام من الفرع' : 'توصيل لباب البيت'}</div>
                  <div className="text-xs text-[#666] mt-1">
                    {opt === 'pickup' ? 'مجاني' : 'حسب العنوان — مجاني فوق ' + freeShippingThreshold + ' جنيه'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Branch picker */}
        <div className="card p-6">
          <h3 className="font-bold text-primary-dark mb-4">
            {fulfillment === 'pickup' ? 'اختر الفرع للاستلام' : 'الفرع الذي يحضّر طلبك'}
          </h3>
          <div className="space-y-3">
            {branches.map((b) => {
              const avail = availability.find((a) => a.branch_id === b.id);
              const disabled = avail ? !avail.can_fulfill : false;
              const selected = branchId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => !disabled && setBranchId(b.id)}
                  disabled={disabled}
                  className={`w-full text-right rounded-s border-2 p-4 transition-colors ${
                    selected
                      ? 'border-primary bg-primary-light'
                      : disabled
                        ? 'border-[#eee] bg-bg-light opacity-60 cursor-not-allowed'
                        : 'border-[#ddd] hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{b.name_ar}</div>
                      <div className="text-xs text-[#666] mt-1">{b.address_ar}</div>
                    </div>
                    {disabled && (
                      <span className="bg-danger/10 text-danger text-xs px-2 py-1 rounded-pill flex-shrink-0 mr-2">
                        غير متوفر بالكمية
                      </span>
                    )}
                    {selected && !disabled && (
                      <i className="fa-solid fa-circle-check text-primary text-xl flex-shrink-0 mr-2" />
                    )}
                  </div>
                  {disabled && avail && avail.missing.length > 0 && (
                    <ul className="text-xs text-danger mt-2 space-y-0.5">
                      {avail.missing.map((m) => (
                        <li key={m.book_id}>
                          • {m.title_ar}: متاح {m.available} فقط (تطلب {m.wanted})
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact + delivery form */}
        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-primary-dark">بياناتك</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">الاسم الكامل</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">الموبايل</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {fulfillment === 'delivery' && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-1">منطقة التوصيل</label>
                <select
                  value={areaType}
                  onChange={(e) => setAreaType(e.target.value as ShippingAreaType)}
                  className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary bg-white"
                >
                  <option value="">اختر المنطقة</option>
                  {AREA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} {shippingRates[o.value] ? `(${shippingRates[o.value]} جنيه)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">المحافظة</label>
                <input
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">العنوان التفصيلي</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary resize-y"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1">ملاحظات (اختياري)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary resize-y"
              placeholder="أي تعليمات خاصة للفرع أو الكابتن"
            />
          </div>
        </div>

        <PaymentMethodPicker
          selected={paymentChoice}
          onSelect={setPaymentChoice}
          disabled={isSubmitting}
        />
      </div>

      {/* Summary */}
      <aside className="card p-6 sticky top-24">
        <h2 className="text-lg font-extrabold text-primary-dark mb-4">ملخص الطلب</h2>

        <ul className="space-y-2 text-sm mb-4 pb-4 border-b border-bg-light">
          {items.map((i) => (
            <li key={i.book_id} className="flex justify-between gap-2">
              <span className="text-[#666] flex-1 truncate">
                {i.title_ar} <span className="text-xs">× {i.quantity}</span>
              </span>
              <span className="font-bold whitespace-nowrap">{formatPrice(i.quantity * i.unit_price)}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-2 text-sm mb-4 pb-4 border-b border-bg-light">
          <div className="flex justify-between">
            <span className="text-[#666]">المجموع ({totalItems} كتاب)</span>
            <span className="font-bold">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#666]">الشحن</span>
            <span className={quote.free_shipping_applied ? 'text-success font-bold' : 'font-bold'}>
              {quote.free_shipping_applied ? 'مجاني 🎉' : formatPrice(quote.fee)}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-baseline mb-4">
          <span className="font-bold">الإجمالي</span>
          <span className="text-2xl font-extrabold text-accent-dark">{formatPrice(total)}</span>
        </div>

        <div className="bg-primary-light text-primary-dark text-xs p-3 rounded-s mb-4">
          {paymentChoice.kind === 'cod'
            ? '💰 الدفع: كاش عند الاستلام'
            : '🔒 الدفع آمن عبر بوابة فوري'}
        </div>

        {submitError && (
          <div className="bg-danger/10 border border-danger/30 text-danger text-sm p-3 rounded-s mb-4">
            {submitError}
          </div>
        )}

        {selectedBranchAvail && !selectedBranchAvail.can_fulfill && (
          <div className="bg-danger/10 border border-danger/30 text-danger text-sm p-3 rounded-s mb-4">
            الفرع المختار لا يستطيع توفير كل الكتب. اختر فرعًا آخر أو قلل الكميات.
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="btn btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? isFawry
              ? 'جاري تجهيز الدفع...'
              : 'جاري تأكيد الطلب...'
            : isFawry
              ? !fawryReady
                ? 'جاري تحميل بوابة فوري...'
                : 'ادفع الآن'
              : 'أكّد الطلب'}
          {!isSubmitting && (
            <i className={`fa-solid ${isFawry ? 'fa-lock' : 'fa-check'} mr-2`} />
          )}
        </button>

        <p className="text-xs text-[#666] mt-3 leading-relaxed">
          بتأكيد الطلب فأنت توافق على{' '}
          <Link href="/legal/terms" className="text-primary hover:underline">شروط الاستخدام</Link>
          . الطلب محجوز لمدة ٢٤ ساعة لحين تأكيد الفرع.
        </p>
      </aside>
    </div>
  );
}
