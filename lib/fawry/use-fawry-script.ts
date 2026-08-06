'use client';

import { useEffect, useState } from 'react';
import type { FawryChargeRequest, FawryDisplayMode } from './types';

export interface FawryPayGlobal {
  checkout: (
    req: FawryChargeRequest,
    cfg: { locale: string; mode: FawryDisplayMode }
  ) => void;
}

declare global {
  interface Window {
    FawryPay?: FawryPayGlobal;
  }
  // fawrypay-payments.js declares the plugin as a top-level `class FawryPay`
  // and never assigns it to `window`. A top-level class in a classic script
  // binds into the global *lexical* environment, which is NOT reflected as a
  // property of the global object — so `window.FawryPay` is always undefined
  // while the bare identifier resolves. Declared with `var` so TypeScript
  // permits the `typeof` guard in getFawryPay() below.
  var FawryPay: FawryPayGlobal | undefined;
}

/**
 * Resolves the Fawry plugin global, whichever way it ended up exposed.
 *
 * Checks `window.FawryPay` first so that if Fawry ever starts attaching it
 * explicitly (their staging and production builds currently do not) we pick
 * that up, then falls back to the bare global-lexical binding their script
 * actually creates. `typeof` rather than a direct read, because referencing
 * an undeclared identifier throws ReferenceError.
 */
export function getFawryPay(): FawryPayGlobal | null {
  if (typeof window === 'undefined') return null;
  if (window.FawryPay) return window.FawryPay;
  return typeof FawryPay !== 'undefined' && FawryPay ? FawryPay : null;
}

/**
 * Lazy-loads the Fawry CSS + JS plugin once per page. Returns `ready` once
 * the plugin global is resolvable so callers can guard the popup trigger.
 *
 * Idempotent: re-mounting the consumer component won't re-inject the tags.
 * The script + stylesheet URLs are env-aware (staging vs production) and
 * passed in by the caller — see app/(storefront)/checkout/page.tsx.
 */
export function useFawryScript(jsUrl: string, cssUrl: string): boolean {
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (getFawryPay()) {
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
      if (getFawryPay()) setReady(true);
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
