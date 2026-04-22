import Link from 'next/link';
import AuthForm from '@/components/auth/auth-form';
import OAuthButtons from '@/components/auth/oauth-buttons';
import { signUpWithEmail } from '@/lib/auth/actions';

export const metadata = { title: 'إنشاء حساب | مكتبة إنفينيتي' };

interface Props { searchParams: Promise<{ next?: string }> }

export default async function RegisterPage({ searchParams }: Props) {
  const { next = '/account' } = await searchParams;
  return (
    <div className="card p-8">
      <h1 className="text-2xl font-extrabold text-primary-dark text-center mb-2">إنشاء حساب جديد</h1>
      <p className="text-center text-[#666] text-sm mb-6">
        سجّل الآن لمتابعة طلباتك واستلام إشعارات العروض
      </p>

      <OAuthButtons next={next} />

      <div className="flex items-center gap-3 my-6 text-[#888] text-sm">
        <div className="flex-1 h-px bg-[#eee]" />
        أو
        <div className="flex-1 h-px bg-[#eee]" />
      </div>

      <AuthForm action={signUpWithEmail} mode="register" next={next} />

      <p className="text-xs text-[#666] mt-4 text-center leading-relaxed">
        بإنشاء حسابك فأنت توافق على{' '}
        <Link href="/legal/terms" className="text-primary hover:underline">شروط الاستخدام</Link>
        {' '}و{' '}
        <Link href="/legal/privacy" className="text-primary hover:underline">سياسة الخصوصية</Link>
      </p>

      <p className="text-center text-sm text-[#666] mt-4 pt-4 border-t border-bg-light">
        لديك حساب؟{' '}
        <Link
          href={`/login${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="text-primary font-bold hover:underline"
        >
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
