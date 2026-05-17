'use client';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export default function OAuthButtons({ next = '/' }: { next?: string }) {
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null);

  async function signIn(provider: 'google' | 'facebook') {
    setBusy(provider);
    const supa = createClient();
    const { error } = await supa.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      alert(error.message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => signIn('google')}
        disabled={busy !== null}
        className="w-full flex items-center justify-center gap-3 border-2 border-[#ddd] hover:border-primary rounded-pill py-3 text-ink font-semibold transition-colors disabled:opacity-50"
      >
        <i className="fa-brands fa-google text-[#DB4437]" />
        {busy === 'google' ? 'جاري التحويل...' : 'متابعة عبر Google'}
      </button>
      <button
        type="button"
        onClick={() => signIn('facebook')}
        disabled={busy !== null}
        className="w-full flex items-center justify-center gap-3 border-2 border-[#ddd] hover:border-primary rounded-pill py-3 text-ink font-semibold transition-colors disabled:opacity-50"
      >
        <i className="fa-brands fa-facebook text-[#1877F2]" />
        {busy === 'facebook' ? 'جاري التحويل...' : 'متابعة عبر Facebook'}
      </button>
    </div>
  );
}
