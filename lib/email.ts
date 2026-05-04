/**
 * Transactional email sender. Uses Resend if RESEND_API_KEY is set;
 * otherwise no-ops gracefully (so dev / preview environments don't crash).
 *
 * Set in `.env.local`:
 *   RESEND_API_KEY=re_xxxxxxxx
 *   EMAIL_FROM="مركز إنفينيتي <orders@your-domain.com>"
 */

const FROM = process.env.EMAIL_FROM ?? 'Infinity Center <onboarding@resend.dev>';
const KEY = process.env.RESEND_API_KEY;

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<void> {
  if (!KEY) {
    console.info('[email] RESEND_API_KEY not set — skipping send to', to, ':', subject);
    return;
  }
  if (!to) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('[email] send failed:', res.status, t);
    }
  } catch (err) {
    console.error('[email] network error:', err);
  }
}

export function orderStatusEmailHtml(args: {
  orderNumber: string;
  status: string;
  customerName: string;
  branchName: string;
  total: number;
  cancelReason?: string | null;
}): { subject: string; html: string } {
  const heading: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: '✅ تم تأكيد طلبك',
      body: `مرحبًا ${args.customerName}،<br>تم تأكيد طلبك رقم <b>${args.orderNumber}</b> في فرع ${args.branchName}. سنخبرك عند جاهزية الطلب للاستلام.`,
    },
    ready: {
      title: '📦 طلبك جاهز للاستلام',
      body: `طلبك رقم <b>${args.orderNumber}</b> جاهز للاستلام من فرع ${args.branchName}. نراك قريبًا!`,
    },
    completed: {
      title: '🎉 تم استلام الطلب',
      body: `شكرًا لتسوقك من مركز إنفينيتي 🌿<br>طلبك رقم <b>${args.orderNumber}</b>.`,
    },
    cancelled: {
      title: '⚠️ تم إلغاء الطلب',
      body: `تم إلغاء طلبك رقم <b>${args.orderNumber}</b>.${args.cancelReason ? `<br>السبب: ${args.cancelReason}` : ''}`,
    },
  };
  const h = heading[args.status] ?? { title: 'تحديث على طلبك', body: `طلبك رقم ${args.orderNumber} الآن في حالة "${args.status}".` };

  const html = `<!doctype html><html dir="rtl" lang="ar"><body style="font-family: 'Tajawal', Arial, sans-serif; background:#f2f2f7; padding:20px; margin:0;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
      <div style="background:linear-gradient(135deg,#3c655a,#578e7e);padding:24px;color:#fff;text-align:center">
        <h1 style="margin:0;font-size:20px">مركز <span style="color:#e3af64">إنفينيتي</span></h1>
      </div>
      <div style="padding:28px;color:#161618;line-height:1.8">
        <h2 style="color:#3c655a;margin:0 0 12px">${h.title}</h2>
        <p>${h.body}</p>
        <p style="background:#f2f2f7;padding:12px;border-radius:8px;font-size:14px">
          <strong>الإجمالي:</strong> ${args.total.toFixed(0)} جنيه
        </p>
      </div>
      <div style="background:#f9f9fb;padding:16px;text-align:center;font-size:12px;color:#666">
        مركز إنفينيتي · الإسكندرية · كفر الدوار
      </div>
    </div>
  </body></html>`;

  return { subject: `${h.title} — ${args.orderNumber}`, html };
}
