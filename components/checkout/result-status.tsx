'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import {
  getOrderPaymentStatus,
  reconcileWithFawry,
  type OrderStatusSnapshot,
} from '@/lib/cart/result-actions';

interface Props {
  orderId: string;
  orderNumber: string;
  total: number;
  /** Fawry processing fee in EGP, if any. Surfaced under the total. */
  fawryFees?: number | null;
  /** Total billed by Fawry (total + fees). Used as the source of truth in the breakdown. */
  paymentAmount?: number | null;
  initialStatus: OrderStatusSnapshot;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

// Result-page status panel with live polling. While payment_status is
// 'pending' we re-fetch every 2s for up to 30s — this catches the typical
// "redirect lands before webhook" race for wallet pushes. After the timeout
// we surface a "we'll email you" message and stop hammering Supabase.
//
// PAYATFAWRY pending orders get a dedicated panel: large copyable reference
// number, 72h expiry countdown, kiosk instructions. Pay-at-kiosk customers
// can leave the page and come back later; the count keeps ticking against
// the server-stored payment_expires_at.

export default function ResultStatus({
  orderId,
  orderNumber,
  total,
  fawryFees,
  paymentAmount,
  initialStatus,
}: Props) {
  const [snapshot, setSnapshot] = useState<OrderStatusSnapshot>(initialStatus);
  const [timedOut, setTimedOut] = useState(false);

  const isPaid = snapshot.payment_status === 'paid';
  const isPending = snapshot.payment_status === 'pending';
  const isFailed = snapshot.payment_status === 'failed' || snapshot.payment_status === 'expired';
  const isPayAtFawry = snapshot.payment_method_detail === 'PAYATFAWRY';

  useEffect(() => {
    if (!isPending) return;
    // PAYATFAWRY orders sit pending for up to 72h — there's no point polling
    // for 30s on those. The reference is the actionable state; the webhook
    // arrives whenever the customer pays at the kiosk (could be days later).
    if (isPayAtFawry) return;

    const started = Date.now();
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const next = await getOrderPaymentStatus(orderId);
      if (cancelled) return;
      if (next) {
        setSnapshot(next);
        if (next.payment_status !== 'pending') return; // stop polling, terminal state
      }
      if (Date.now() - started >= POLL_TIMEOUT_MS) {
        // 30s with no webhook arrival — ask Fawry directly once before
        // surfacing "we'll email you". This catches wallet pushes where the
        // webhook lags the redirect by more than half a minute.
        try {
          const reconciled = await reconcileWithFawry(orderId);
          if (cancelled) return;
          if (reconciled) {
            setSnapshot(reconciled);
            if (reconciled.payment_status !== 'pending') return;
          }
        } catch {
          // Reconciliation is best-effort; fall through to the timed-out copy.
        }
        setTimedOut(true);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    const timeoutId = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isPending, isPayAtFawry, orderId]);

  return (
    <>
      {isPaid && (
        <PaidPanel
          orderNumber={orderNumber}
          total={total}
          fawryFees={fawryFees ?? null}
          paymentAmount={paymentAmount ?? null}
        />
      )}

      {isPending && isPayAtFawry && (
        <PayAtFawryPanel
          orderNumber={orderNumber}
          total={total}
          fawryRef={snapshot.fawry_ref_number}
          expiresAt={snapshot.payment_expires_at}
        />
      )}

      {isPending && !isPayAtFawry && (
        <PendingPanel
          orderNumber={orderNumber}
          total={total}
          fawryRef={snapshot.fawry_ref_number}
          timedOut={timedOut}
        />
      )}

      {isFailed && (
        <FailedPanel orderNumber={orderNumber} status={snapshot.payment_status} />
      )}
    </>
  );
}

function PaidPanel({
  orderNumber,
  total,
  fawryFees,
  paymentAmount,
}: {
  orderNumber: string;
  total: number;
  fawryFees: number | null;
  paymentAmount: number | null;
}) {
  // Fees are itemised when Fawry charged the customer more than the order
  // total — typical for card/wallet payments where Fawry adds a processing
  // fee. P2-6 in the audit.
  const billed = paymentAmount ?? total;
  const showBreakdown = fawryFees != null && fawryFees > 0 && billed > total + 0.001;

  return (
    <div className="card p-8 text-center">
      <div className="w-20 h-20 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4 text-4xl">
        <i className="fa-solid fa-check" />
      </div>
      <h1 className="text-2xl font-extrabold text-primary-dark mb-2">تم الدفع بنجاح!</h1>
      <p className="text-[#666]">
        رقم الطلب: <span className="font-bold text-accent-dark">{orderNumber}</span>
      </p>
      {showBreakdown ? (
        <div className="text-sm text-[#666] mt-4 pt-4 border-t border-bg-light space-y-1.5">
          <div className="flex justify-between">
            <span>إجمالي الطلب</span>
            <span>{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between">
            <span>رسوم فوري</span>
            <span>{formatPrice(fawryFees!)}</span>
          </div>
          <div className="flex justify-between font-bold text-ink pt-1.5 border-t border-bg-light">
            <span>المبلغ المدفوع</span>
            <span>{formatPrice(billed)}</span>
          </div>
        </div>
      ) : null}
      <Footer total={showBreakdown ? undefined : total}>
        <Link href="/account/orders" className="btn btn-primary">عرض طلباتي</Link>
        <Link href="/books" className="btn btn-outline">متابعة التسوق</Link>
      </Footer>
    </div>
  );
}

function PendingPanel({
  orderNumber,
  total,
  fawryRef,
  timedOut,
}: {
  orderNumber: string;
  total: number;
  fawryRef: string | null;
  timedOut: boolean;
}) {
  return (
    <div className="card p-8 text-center">
      <div className="w-20 h-20 rounded-full bg-accent/10 text-accent-dark flex items-center justify-center mx-auto mb-4 text-4xl">
        <i className={`fa-solid ${timedOut ? 'fa-envelope' : 'fa-hourglass-half fa-spin'}`} />
      </div>
      <h1 className="text-2xl font-extrabold text-primary-dark mb-2">
        {timedOut ? 'لسه بنأكد الدفع' : 'جارٍ تأكيد الدفع'}
      </h1>
      <p className="text-[#666] leading-loose">
        {timedOut ? (
          <>
            تأكيد الدفع لطلب{' '}
            <span className="font-bold text-accent-dark">{orderNumber}</span> بياخد وقت أطول من المعتاد.
            هنبعتلك بريد إلكتروني فور وصول التأكيد.
          </>
        ) : (
          <>
            طلبك رقم{' '}
            <span className="font-bold text-accent-dark">{orderNumber}</span> في انتظار تأكيد فوري.
            الصفحة هتتحدث تلقائيًا.
          </>
        )}
      </p>
      {fawryRef && (
        <p className="text-sm text-[#666] mt-3">
          الرقم المرجعي: <span className="font-bold">{fawryRef}</span>
        </p>
      )}
      <Footer total={total}>
        <Link href="/account/orders" className="btn btn-primary">عرض طلباتي</Link>
        <Link href="/books" className="btn btn-outline">متابعة التسوق</Link>
      </Footer>
    </div>
  );
}

function PayAtFawryPanel({
  orderNumber,
  total,
  fawryRef,
  expiresAt,
}: {
  orderNumber: string;
  total: number;
  fawryRef: string | null;
  expiresAt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : null;
  const remainingMs = expiresMs != null ? expiresMs - now : null;
  const remainingHours = remainingMs != null ? Math.max(0, Math.floor(remainingMs / 3_600_000)) : null;
  const remainingMinutes =
    remainingMs != null ? Math.max(0, Math.floor((remainingMs % 3_600_000) / 60_000)) : null;
  const expired = remainingMs != null && remainingMs <= 0;

  async function copyRef() {
    if (!fawryRef) return;
    try {
      await navigator.clipboard.writeText(fawryRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked — user can still tap-and-hold to select.
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-accent/10 text-accent-dark flex items-center justify-center mx-auto mb-4 text-4xl">
          <i className="fa-solid fa-receipt" />
        </div>
        <h1 className="text-2xl font-extrabold text-primary-dark mb-2">ادفع في أقرب منفذ فوري</h1>
        <p className="text-[#666] text-sm leading-loose">
          طلبك رقم <span className="font-bold text-accent-dark">{orderNumber}</span> محجوز.
          ادفع في أي ماكينة فوري برقم مرجعي خلال {expired ? '...' : `${remainingHours ?? 72} ساعة`}.
        </p>
      </div>

      {fawryRef && (
        <div className="bg-primary-light border-2 border-primary/30 rounded-card p-6 text-center mb-5">
          <p className="text-xs text-primary-dark font-bold mb-2">الرقم المرجعي للدفع</p>
          <p
            className="text-3xl sm:text-4xl font-extrabold text-primary-dark tracking-wider mb-3 select-all"
            dir="ltr"
          >
            {fawryRef}
          </p>
          <button
            type="button"
            onClick={copyRef}
            className="btn btn-outline text-sm py-2 px-5"
          >
            <i className={`fa-solid ${copied ? 'fa-check text-success' : 'fa-copy'} ml-2`} />
            {copied ? 'تم النسخ' : 'انسخ الرقم'}
          </button>
        </div>
      )}

      <div className="bg-bg-light rounded-s p-4 mb-5 text-sm space-y-2 leading-loose">
        <p className="font-bold text-primary-dark">
          <i className="fa-solid fa-circle-info ml-1" />
          خطوات الدفع:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-[#444] pr-1">
          <li>روح لأقرب منفذ فوري (مكتبة، صيدلية، سوبر ماركت).</li>
          <li>قول للموظف رقم المرجع اللي فوق.</li>
          <li>ادفع المبلغ كاش.</li>
          <li>هتستلم إيصال — احتفظ بيه لحد ما توصلك رسالة التأكيد.</li>
        </ol>
      </div>

      {!expired && remainingHours != null && remainingMinutes != null && (
        <div className="text-center text-sm text-[#666] mb-5">
          <i className="fa-regular fa-clock ml-1" />
          متبقي للسداد: <span className="font-bold text-accent-dark">{remainingHours} ساعة و {remainingMinutes} دقيقة</span>
        </div>
      )}

      {expired && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm p-3 rounded-s mb-5 text-center">
          انتهت صلاحية الرقم المرجعي. ابعت لنا واتساب لإصدار طلب جديد.
        </div>
      )}

      <Footer total={total}>
        <Link href="/account/orders" className="btn btn-primary">عرض طلباتي</Link>
        <Link href="/books" className="btn btn-outline">متابعة التسوق</Link>
      </Footer>
    </div>
  );
}

function FailedPanel({
  orderNumber,
  status,
}: {
  orderNumber: string;
  status: string;
}) {
  return (
    <div className="card p-8 text-center">
      <div className="w-20 h-20 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4 text-4xl">
        <i className="fa-solid fa-xmark" />
      </div>
      <h1 className="text-2xl font-extrabold text-primary-dark mb-2">
        {status === 'expired' ? 'انتهت صلاحية الدفع' : 'لم يكتمل الدفع'}
      </h1>
      <p className="text-[#666] leading-loose">
        لم نتمكن من تأكيد عملية الدفع لطلب{' '}
        <span className="font-bold text-accent-dark">{orderNumber}</span>. يمكنك إعادة المحاولة من السلة.
      </p>
      <Footer>
        <Link href="/cart" className="btn btn-primary">العودة للسلة</Link>
        <Link href="/books" className="btn btn-outline">متابعة التسوق</Link>
      </Footer>
    </div>
  );
}

function Footer({
  total,
  children,
}: {
  total?: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {total != null && (
        <div className="text-sm text-[#666] mt-4 pt-4 border-t border-bg-light">
          <div>
            الإجمالي: <span className="font-bold text-ink">{formatPrice(total)}</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 justify-center mt-6">{children}</div>
    </>
  );
}
