'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createManualOrder, type OversellLine } from '@/lib/admin/order-actions';
import { formatPrice } from '@/lib/utils';
import type { GradeLevel, PaymentMethod, PaymentType } from '@/lib/types';

interface BranchOpt {
  id: string;
  name_ar: string;
}

interface BookOpt {
  id: number;
  title_ar: string;
  final_price: number;
  grade_level: GradeLevel;
  teacher: { name_ar: string } | null;
}

interface Props {
  branches: BranchOpt[];
  books: BookOpt[];
  /** available[branch_id][book_id] = quantity - reserved */
  available: Record<string, Record<number, number>>;
  defaultBranchId: string | null;
}

interface ItemRow {
  key: string;
  book_id: number | null;
  quantity: number;
}

const GRADE_LABELS: Record<GradeLevel, string> = {
  first_secondary: 'الصف الأول الثانوي',
  second_secondary: 'الصف الثاني الثانوي',
  third_secondary: 'الصف الثالث الثانوي',
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'كاش (COD)',
  card: 'بطاقة',
  wallet: 'محفظة إلكترونية',
  fawry: 'فوري',
  instapay: 'إنستاباي',
  bank_transfer: 'تحويل بنكي',
};

// Inferred default for payment_method when payment_type changes — purely a UX
// helper. Staff can still override; payment_type itself is never auto-assumed.
function defaultMethodFor(type: PaymentType | ''): PaymentMethod {
  return type === 'online' ? 'card' : 'cod';
}

function newItemRow(): ItemRow {
  return { key: Math.random().toString(36).slice(2), book_id: null, quantity: 1 };
}

export default function ManualOrderForm({ branches, books, available, defaultBranchId }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [branchId, setBranchId] = useState<string>(defaultBranchId ?? branches[0]?.id ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState<GradeLevel | ''>('');
  const [paymentType, setPaymentType] = useState<PaymentType | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [saleType, setSaleType] = useState<'completed_at_counter' | 'pending_phone_order'>(
    'completed_at_counter',
  );
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([newItemRow()]);

  // Oversell confirmation state — when the server returns
  // requires_oversell_confirmation, we surface the per-line overage and
  // resubmit with oversell_confirmed=true once staff acknowledges.
  const [pendingOversells, setPendingOversells] = useState<OversellLine[] | null>(null);
  const [staffNote, setStaffNote] = useState('');

  const priceById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const subtotal = useMemo(
    () =>
      items.reduce((s, it) => {
        if (!it.book_id) return s;
        const b = priceById.get(it.book_id);
        return s + (b ? Number(b.final_price) * it.quantity : 0);
      }, 0),
    [items, priceById],
  );

  function setItem(key: string, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeItem(key: string) {
    setItems((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  function submit(oversellConfirmed: boolean) {
    setErr(null);
    setOk(null);

    if (!paymentType) {
      setErr('يجب تحديد نوع الدفع (online أو offline) — لا يتم افتراضه تلقائيًا.');
      return;
    }
    const validItems = items
      .filter((i) => i.book_id && i.quantity > 0)
      .map((i) => ({ book_id: i.book_id!, quantity: i.quantity }));
    if (validItems.length === 0) {
      setErr('يجب اختيار كتاب واحد على الأقل.');
      return;
    }

    start(async () => {
      const res = await createManualOrder({
        customer_full_name: name,
        customer_phone: phone,
        customer_grade_level: grade || null,
        branch_id: branchId,
        items: validItems,
        payment_type: paymentType,
        payment_method: paymentMethod,
        sale_type: saleType,
        notes: notes || null,
        oversell_confirmed: oversellConfirmed,
        staff_note: staffNote.trim() || null,
      });
      if (res.requires_oversell_confirmation && res.oversells) {
        setPendingOversells(res.oversells);
        return;
      }
      if (res.error) {
        setErr(res.error);
        setPendingOversells(null);
        return;
      }
      const reuseNote = res.reused_existing_customer
        ? ' — تم ربط الطلب بعميل موجود برقم نفس الهاتف'
        : '';
      const oversellTag =
        pendingOversells && pendingOversells.length > 0
          ? ' — تم التسجيل مع علامة تجاوز مخزون'
          : '';
      setOk(
        `تم إنشاء الطلب ${res.order_number} ✓ — ${tagsLabel(paymentType, 'dashboard')}${oversellTag}${reuseNote}`,
      );
      // Move on to the order detail after a brief moment so staff sees the tags.
      setTimeout(() => router.push(`/admin/orders/${res.order_id}`), 800);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(false);
  }

  // Phase B: every active book is selectable; the available count is shown
  // alongside the row so staff can knowingly oversell a low-stock SKU.
  const branchAvailable = available[branchId] ?? {};
  const selectableBooks = books;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {err && (
        <div className="bg-danger/10 border border-danger/30 text-danger p-3 rounded-s text-sm">
          {err}
        </div>
      )}
      {ok && (
        <div className="bg-success/10 border border-success/30 text-success p-3 rounded-s text-sm">
          {ok}
        </div>
      )}

      {/* Customer */}
      <section className="card p-5">
        <h2 className="font-bold mb-4 text-primary-dark">العميل</h2>
        <p className="text-xs text-[#666] mb-4">
          إذا كان الهاتف مسجّلاً مسبقًا، سيتم ربط الطلب بالعميل القائم تلقائيًا. وإلا
          سيُنشأ عميل جديد (ضيف).
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="الاسم *">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="اسم العميل"
            />
          </Field>
          <Field label="رقم الهاتف *">
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className={inputCls}
              placeholder="01xxxxxxxxx"
            />
          </Field>
          <Field label="الصف الدراسي (اختياري)">
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as GradeLevel | '')}
              className={inputCls}
            >
              <option value="">— غير محدد —</option>
              {(Object.keys(GRADE_LABELS) as GradeLevel[]).map((g) => (
                <option key={g} value={g}>
                  {GRADE_LABELS[g]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Branch */}
      <section className="card p-5">
        <h2 className="font-bold mb-4 text-primary-dark">الفرع</h2>
        {branches.length === 1 ? (
          <div className="text-sm">
            <span className="text-[#666] ml-2">الفرع:</span>
            <span className="font-bold">{branches[0].name_ar}</span>
          </div>
        ) : (
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={inputCls}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name_ar}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Items */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-primary-dark">الكتب</h2>
          <button
            type="button"
            onClick={() => setItems((rows) => [...rows, newItemRow()])}
            className="text-sm bg-primary-light text-primary-dark px-3 py-1.5 rounded-s font-bold hover:bg-primary hover:text-white transition-colors"
          >
            + إضافة كتاب
          </button>
        </div>

        <div className="space-y-3">
          {items.map((row) => {
            const stockLeft = row.book_id ? branchAvailable[row.book_id] ?? 0 : 0;
            const book = row.book_id ? priceById.get(row.book_id) : null;
            const willOversell = !!row.book_id && row.quantity > stockLeft;
            return (
              <div key={row.key} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 md:col-span-7">
                  <label className="block text-xs font-semibold mb-1 text-[#555]">
                    الكتاب
                  </label>
                  <select
                    value={row.book_id ?? ''}
                    onChange={(e) =>
                      setItem(row.key, {
                        book_id: e.target.value ? Number(e.target.value) : null,
                        quantity: 1,
                      })
                    }
                    className={inputCls}
                  >
                    <option value="">— اختر كتابًا —</option>
                    {selectableBooks.map((b) => {
                      const stock = branchAvailable[b.id] ?? 0;
                      return (
                        <option key={b.id} value={b.id}>
                          {b.title_ar}
                          {b.teacher ? ` — ${b.teacher.name_ar}` : ''} ({formatPrice(Number(b.final_price))})
                          {' • '}
                          {stock > 0 ? `متاح ${stock}` : 'نفد المخزون'}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="block text-xs font-semibold mb-1 text-[#555]">
                    الكمية {row.book_id ? `(متاح ${stockLeft})` : ''}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) =>
                      setItem(row.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className={`${inputCls} ${willOversell ? 'border-accent-dark text-accent-dark' : ''}`}
                  />
                  {willOversell && (
                    <p className="text-[0.7rem] text-accent-dark mt-1 leading-tight">
                      ⚠ يتجاوز المخزون بـ {row.quantity - stockLeft} نسخة — سيُعتبر طلب مؤجل.
                    </p>
                  )}
                </div>
                <div className="col-span-4 md:col-span-1 text-sm font-bold text-left">
                  {book ? formatPrice(Number(book.final_price) * row.quantity) : '—'}
                </div>
                <div className="col-span-2 md:col-span-1 text-left">
                  <button
                    type="button"
                    onClick={() => removeItem(row.key)}
                    disabled={items.length === 1}
                    className="text-danger hover:bg-danger/10 px-2 py-1.5 rounded-s text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="حذف"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-bg-light mt-5 pt-4 text-left">
          <span className="text-sm text-[#666] ml-2">الإجمالي:</span>
          <span className="font-extrabold text-lg text-primary-dark">
            {formatPrice(subtotal)}
          </span>
        </div>
      </section>

      {/* Tags & sale type */}
      <section className="card p-5">
        <h2 className="font-bold mb-4 text-primary-dark">الدفع والوسوم</h2>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">
            نوع الدفع * <span className="text-xs text-danger">(لا يتم افتراضه)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <RadioPill
              checked={paymentType === 'online'}
              onClick={() => {
                setPaymentType('online');
                setPaymentMethod(defaultMethodFor('online'));
              }}
              label="online — دفع رقمي"
            />
            <RadioPill
              checked={paymentType === 'offline'}
              onClick={() => {
                setPaymentType('offline');
                setPaymentMethod(defaultMethodFor('offline'));
              }}
              label="offline — كاش / تحويل / POS"
            />
          </div>
        </div>

        <Field label="طريقة الدفع">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className={inputCls}
          >
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-2">طبيعة الطلب</label>
          <div className="space-y-2">
            <RadioCard
              checked={saleType === 'completed_at_counter'}
              onClick={() => setSaleType('completed_at_counter')}
              title="بيع داخل الفرع — تم الدفع الآن"
              hint="الحالة تصبح: مكتمل + مدفوع، ويتم خصم المخزون فورًا."
            />
            <RadioCard
              checked={saleType === 'pending_phone_order'}
              onClick={() => setSaleType('pending_phone_order')}
              title="طلب هاتفي — قيد الدفع"
              hint="الحالة تبقى: قيد المراجعة + قيد الانتظار، ويُحجز المخزون مؤقتًا."
            />
          </div>
        </div>

        <div className="mt-4 bg-primary-light/50 border border-primary-light p-3 rounded-s text-xs">
          <div className="font-bold mb-1">الوسوم المطبّقة:</div>
          <div>
            <code className="bg-white px-1.5 py-0.5 rounded mr-1">payment_type</code>
            ={' '}
            <span className={paymentType ? 'font-bold' : 'text-danger'}>
              {paymentType || '— مطلوب —'}
            </span>
          </div>
          <div>
            <code className="bg-white px-1.5 py-0.5 rounded mr-1">order_source</code>
            = <span className="font-bold">dashboard</span>
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="card p-5">
        <Field label="ملاحظات (اختياري)">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
            placeholder="أي تفاصيل إضافية حول الطلب"
          />
        </Field>
      </section>

      {pendingOversells && pendingOversells.length > 0 && (
        <section className="card border-2 border-accent-dark/50 bg-accent/5 p-5">
          <h2 className="font-bold mb-3 text-accent-dark">
            <i className="fa-solid fa-triangle-exclamation ml-2" />
            تجاوز المخزون — يحتاج تأكيد
          </h2>
          <p className="text-sm mb-3 text-ink/80">
            هذا الطلب يتجاوز الكميات المتاحة في الفرع. عند التأكيد سيُسجَّل
            كطلب مؤجل (backorder) وسيُحفَظ في سجل التدقيق مع ملاحظتك.
          </p>
          <ul className="text-sm space-y-1 mb-4">
            {pendingOversells.map((o) => (
              <li key={o.book_id} className="flex justify-between gap-3">
                <span className="text-ink/90">
                  {o.title_ar ?? `كتاب #${o.book_id}`}
                </span>
                <span className="font-bold text-accent-dark whitespace-nowrap">
                  متاح {o.available_stock} / مطلوب {o.requested_qty} → عجز {o.overage}
                </span>
              </li>
            ))}
          </ul>
          <Field label="ملاحظة تدقيق (اختياري — تُرفق بسجل القرار)">
            <textarea
              rows={2}
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              className={inputCls}
              placeholder="مثلاً: نسخ في الطريق من المورد، أو بيع داخل المعرض"
            />
          </Field>
          <div className="flex gap-3 mt-4 justify-end">
            <button
              type="button"
              onClick={() => setPendingOversells(null)}
              className="btn bg-white text-ink hover:bg-bg-light px-5 py-2"
            >
              تعديل الكميات
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => submit(true)}
              className="btn btn-primary px-6 py-2 disabled:opacity-50"
            >
              {busy ? 'جاري الحفظ...' : 'تأكيد التجاوز وإنشاء الطلب'}
            </button>
          </div>
        </section>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.push('/admin/orders')}
          className="btn bg-white text-ink hover:bg-bg-light px-6 py-2.5"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={busy || !!pendingOversells}
          className="btn btn-primary px-8 py-2.5 disabled:opacity-50"
        >
          {busy ? 'جاري الحفظ...' : 'حفظ الطلب'}
        </button>
      </div>
    </form>
  );
}

function tagsLabel(pt: PaymentType, src: 'storefront' | 'dashboard') {
  return `payment_type=${pt} • order_source=${src}`;
}

const inputCls =
  'w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1">{label}</label>
      {children}
    </div>
  );
}

function RadioPill({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-pill text-sm font-bold border transition-colors ${
        checked
          ? 'bg-primary text-white border-primary'
          : 'bg-white text-ink border-bg-light hover:bg-primary-light'
      }`}
    >
      {label}
    </button>
  );
}

function RadioCard({
  checked,
  onClick,
  title,
  hint,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-right block p-3 rounded-s border transition-colors ${
        checked
          ? 'bg-primary-light border-primary'
          : 'bg-white border-bg-light hover:bg-bg-light'
      }`}
    >
      <div className="font-bold text-sm">{title}</div>
      <div className="text-xs text-[#666] mt-0.5">{hint}</div>
    </button>
  );
}
