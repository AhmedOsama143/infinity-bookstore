'use client';

import { useEffect, useState } from 'react';
import type { FawryChargeRequest, FawryDisplayMode } from './types';

declare global {
  interface Window {
    FawryPay?: {
      checkout: (
        req: FawryChargeRequest,
        cfg: { locale: string; mode: FawryDisplayMode }
      ) => void;
    };
  }
}

/**
 * Lazy-loads the Fawry CSS + JS plugin once per page. Returns `ready` once
 * `window.FawryPay` is available so callers can guard the popup trigger.
 *
 * Idempotent: re-mounting the consumer component won't re-inject the tags.
 * The script + stylesheet URLs are env-aware (staging vs production) and
 * passed in by the caller — see app/(storefront)/checkout/page.tsx.
 */
export function useFawryScript(jsUrl: string, cssUrl: string): boolean {
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.FawryPay) {
      setReady(true);
      return;
    }

    // CSS — fire and forget; if it fails the popup still functions, just
    // unstyled, which is better than blocking checkout entirely.
    if (cssUrl && !document.querySelector(`link[href="${cssUrl}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      document.head.appendChild(link);
    }

    // JS — handle the case where another mount injected the tag but it
    // hasn't finished loading yet. We attach a load listener instead of
    // duplicating the tag.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${jsUrl}"]`);
    if (existing) {
      existing.addEventListener('load', () => setReady(true), { once: true });
      // It may have already loaded between mount and this effect.
      if (window.FawryPay) setReady(true);
      return;
    }

    const s = document.createElement('script');
    s.src = jsUrl;
    s.async = true;
    s.onload = () => setReady(true);
    s.onerror = () => {
      console.error('Failed to load Fawry plugin script:', jsUrl);
    };
    document.head.appendChild(s);
  }, [jsUrl, cssUrl]);

  return ready;
}
