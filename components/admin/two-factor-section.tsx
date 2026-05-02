'use client';
import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { setMfaEnabled } from '@/lib/admin/settings-actions';

interface Props {
  email: string | null;
  enrolled: boolean;
  factorId: string | null;
  factorStatus: string | null;
}

export default function TwoFactorSection({ enrolled, factorId, factorStatus }: Props) {
  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function startEnrollment() {
    setError(null);
    setSuccess(null);
    const supa = createClient();
    // If a stale (unverified) factor lingers, clean it up first.
    if (factorId && factorStatus !== 'verified') {
      await supa.auth.mfa.unenroll({ factorId });
    }
    const { data, error } = await supa.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Admin TOTP',
    });
    if (error) {
      setError(error.message);
      return;
    }
    setEnrollData({
      id: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verify() {
    if (!enrollData) return;
    setError(null);
    const supa = createClient();
    const challenge = await supa.auth.mfa.challenge({ factorId: enrollData.id });
    if (challenge.error) {
      setError(challenge.error.message);
      return;
    }
    const { error } = await supa.auth.mfa.verify({
      factorId: enrollData.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    if (error) {
      setError('الكود غير صحيح، حاول مرة أخرى');
      return;
    }
    startTransition(async () => {
      await setMfaEnabled(true);
      setEnrollData(null);
      setCode('');
      setSuccess('تم تفعيل المصادقة الثنائية بنجاح ✓');
      setTimeout(() => window.location.reload(), 1500);
    });
  }

  async function disable() {
    if (!factorId) return;
    if (!confirm('سيتم إلغاء تفعيل المصادقة الثنائية. متابعة؟')) return;
    setError(null);
    const supa = createClient();
    const { error } = await supa.auth.mfa.unenroll({ factorId });
    if (error) {
      setError(error.message);
      return;
    }
    startTransition(async () => {
      await setMfaEnabled(false);
      setSuccess('تم إلغاء التفعيل');
      setTimeout(() => window.location.reload(), 1000);
    });
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-bg-light pb-3">
        <div>
          <h2 className="text-lg font-bold text-primary-dark">المصادقة الثنائية (2FA)</h2>
          <p className="text-xs text-[#666]">طبقة حماية إضافية لحسابك</p>
        </div>
        <span
          className={`px-3 py-1 rounded-pill text-xs font-bold ${
            enrolled ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent-dark'
          }`}
        >
          {enrolled ? 'مفعّلة' : 'غير مفعّلة'}
        </span>
      </div>

      {error && (
        <div className="text-sm p-3 rounded-s bg-danger/10 text-danger border border-danger/20">{error}</div>
      )}
      {success && (
        <div className="text-sm p-3 rounded-s bg-success/10 text-success border border-success/20">{success}</div>
      )}

      {enrolled ? (
        <div className="space-y-3">
          <p className="text-sm text-[#444]">
            حسابك محمي بالمصادقة الثنائية. عند تسجيل الدخول ستحتاج إلى رمز من تطبيق المصادقة.
          </p>
          <button
            type="button"
            onClick={disable}
            disabled={isPending}
            className="btn btn-outline border-danger text-danger hover:bg-danger hover:text-white text-sm disabled:opacity-50"
          >
            <i className="fa-solid fa-shield-halved ml-2" />
            إلغاء تفعيل المصادقة الثنائية
          </button>
        </div>
      ) : enrollData ? (
        <div className="space-y-4">
          <div className="text-sm text-[#444] space-y-2">
            <p><b>1.</b> افتح تطبيق Google Authenticator أو Authy على هاتفك</p>
            <p><b>2.</b> امسح كود QR التالي:</p>
          </div>
          <div className="flex justify-center bg-white p-4 rounded-card border border-bg-light">
            {/* Supabase returns an SVG data-URL */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollData.qr} alt="TOTP QR" className="w-48 h-48" />
          </div>
          <div className="text-xs text-center text-[#666]">
            أو أدخل المفتاح يدويًا:
            <code className="block mt-1 font-mono bg-bg-light p-2 rounded-s break-all" dir="ltr">
              {enrollData.secret}
            </code>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1"><b>3.</b> أدخل الكود من التطبيق</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              dir="ltr"
              maxLength={6}
              className="w-full px-4 py-2.5 rounded-s border border-[#ddd] focus:outline-none focus:border-primary text-center text-xl tracking-widest font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={verify}
              disabled={code.length !== 6 || isPending}
              className="btn btn-primary disabled:opacity-50"
            >
              {isPending ? 'جاري التحقق...' : 'تأكيد التفعيل'}
            </button>
            <button
              type="button"
              onClick={() => setEnrollData(null)}
              className="btn btn-outline"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#444]">
            للتفعيل، سيتم توليد رمز QR يمكنك مسحه بتطبيق Google Authenticator أو Authy.
          </p>
          <button type="button" onClick={startEnrollment} className="btn btn-primary text-sm">
            <i className="fa-solid fa-shield-halved ml-2" />
            تفعيل المصادقة الثنائية
          </button>
        </div>
      )}
    </div>
  );
}
