'use client';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';
import { safeNextPath } from '@/lib/auth/safe-next';

export default function OAuthButtons({ next = '/' }: { next?: string }) {
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    const supa = createClient();
    const safeNext = safeNextPath(next);
    const { error } = await supa.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      },
    });
    if (error) {
      alert(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 border-2 border-[#ddd] hover:border-primary rounded-pill py-3 text-ink font-semibold transition-colors disabled:opacity-50"
      >
        <i className="fa-brands fa-google text-[#DB4437]" />
        {busy ? 'جاري التحويل...' : 'متابعة عبر Google'}
      </button>
    </div>
  );
}
