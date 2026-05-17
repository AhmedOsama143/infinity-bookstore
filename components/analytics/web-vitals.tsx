'use client';

import { useReportWebVitals } from 'next/web-vitals';

// Forwards Core Web Vitals (LCP, INP, CLS, FCP, TTFB) into the GTM dataLayer
// as a `web_vitals` event. Wire a GA4 Event tag in GTM listening for this
// event name, with the variables `vitals_name` / `vitals_value` / `vitals_id`.
//
// We send the rounded value GA4 expects (CLS gets *1000, others gets ms).
// `navigationType` lets you filter cold-load vs SPA-nav vitals separately.

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      event: 'web_vitals',
      vitals_name: metric.name,
      vitals_id: metric.id,
      vitals_value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      vitals_rating: metric.rating,
      vitals_navigation_type: metric.navigationType,
    });
  });
  return null;
}
