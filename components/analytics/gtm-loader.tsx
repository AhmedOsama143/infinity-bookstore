import Script from 'next/script';

// Renders the GTM container <script> in <head> and the <noscript> iframe
// fallback in <body>. Reads NEXT_PUBLIC_GTM_ID at module-eval time on the
// server (it's inlined into the bundle by Next.js since it's NEXT_PUBLIC_*).
// When the env var is empty / unset we render nothing — no dataLayer, no
// network calls, no console noise. Drop your GTM-XXXXXXX into .env.local and
// redeploy to start collecting.

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim();

export function GtmHead() {
  if (!GTM_ID) return null;
  // Standard GTM snippet, transcribed to JSX so it survives Next.js script
  // hoisting and CSP nonces. We initialise dataLayer before the loader so
  // events fired during the first render don't get dropped.
  return (
    <Script id="gtm-init" strategy="afterInteractive">
      {`
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        var f = document.getElementsByTagName('script')[0];
        var j = document.createElement('script');
        j.async = true;
        j.src = 'https://www.googletagmanager.com/gtm.js?id=${GTM_ID}';
        f.parentNode.insertBefore(j, f);
      `}
    </Script>
  );
}

export function GtmBody() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
