import Link from 'next/link';
import AuthForm from '@/components/auth/auth-form';
import OAuthButtons from '@/components/auth/oauth-buttons';
import { signInWithEmail } from '@/lib/auth/actions';

export const metadata = { title: 'تسجيل الدخول | مكتبة إنفينيتي' };

interface Props { searchParams: Promise<{ next?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { next = '/account' } = await searchParams;
  return (
    <div className="card p-8">
      <h1 className="text-2xl font-extrabold text-primary-dark text-center mb-2">تسجيل الدخول</h1>
      <p className="text-center text-[#666] text-sm mb-6">ادخل لمتابعة طلباتك ومفضلاتك</p>

      <OAuthButtons next={next} />

      <div className="flex items-center gap-3 my-6 text-[#888] text-sm">
        <div className="flex-1 h-px bg-[#eee]" />
        أو
        <div className="flex-1 h-px bg-[#eee]" />
      </div>

      <AuthForm action={signInWithEmail} mode="login" next={next} />

      <p className="text-center text-sm text-[#666] mt-6">
        ليس لديك حساب؟{' '}
        <Link
          href={`/register${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="text-primary font-bold hover:underline"
        >
          أنشئ حساب جديد
        </Link>
      </p>
    </div>
  );
}
