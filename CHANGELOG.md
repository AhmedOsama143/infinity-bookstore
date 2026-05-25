# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-25

First public release.

### Added
- Storefront (Next.js 15 App Router, React 19, Tailwind 3, Arabic RTL):
  home, books list + detail, teachers list + detail, search, cart, wishlist,
  checkout (with Fawry online payments + cash on delivery), account / orders /
  notifications, branches, delivery info, about, FAQ, legal pages.
- Admin dashboard: orders (with manual creation + per-branch scope for branch
  managers), books (CRUD + CSV bulk import), teachers, branches, payments
  audit, promos, shipping rates, returns, reviews, transfers, settings,
  notifications.
- Fawry integration (slices 1-11): order creation server action, signed
  charge request, server-to-server webhook with signature verification +
  idempotency + amount-mismatch check + cancelled-order guard, redirect
  result page with live polling, refund endpoint, hourly expire-orders cron,
  staff `/admin/payments` dashboard.
- Stock integrity (4 phases): customer block + staff oversell + 15-min cart
  holds + atomic claim + back-in-stock CTA.
- `audit_log` table + structured logging via `lib/log.ts`.
- Sitemap, robots, per-page metadata, OpenGraph + Twitter cards, JSON-LD
  for BookStore organization, individual books, and WebSite +
  SearchAction for the sitelinks searchbox.
- `/api/health` liveness + readiness endpoint.
- Vitest unit tests + Playwright E2E smoke.

### Security
- Closes 7 CVEs in `next` (SSRF, middleware bypass, DoS, cache poisoning) by
  bumping to `^15.5.18`; pulled in fixed `brace-expansion` and `ws`.
- Closes OAuth open-redirect via `?next=` at every sink (callback route, 3
  server actions, OAuthButtons client) — `lib/auth/safe-next.ts`.
- Middleware now preserves refreshed-session cookies across redirect
  responses (per `@supabase/ssr` docs).
- `/api/orders/create` and `/api/fawry/charge` migrated to Next.js server
  actions for CSRF protection — route handlers deleted.
- Admin role check now uses the service-role client so a future tightening of
  `admin_users` RLS doesn't silently lock out admins.
- 20 raw `error.message` returns in admin server actions routed through a new
  `translateDbError` sanitizer — schema names, RLS denials, FK constraints
  no longer leak to the client.
- Upstash sliding-window rate limit (60 req/min/IP) on the Fawry webhook.
- Webhook now logs unrecognised payment-method values to `payment_events`
  instead of silently dropping them.
- Refund endpoint hides internal Fawry error codes from API clients; detail
  remains on the audit row.
- `markReturnReceived` race + non-idempotency fixed via migration 022
  (`mark_return_received_atomic` Postgres function).

### Accessibility
- Skip-to-main link in root layout (WCAG 2.4.1).
- Admin layout wraps children in `<main>` so screen readers see the
  landmark.
- `<html lang="ar" dir="rtl">` + RTL-aware `border-e` on the active
  account-nav indicator.
- Payment-method tiles have `focus-visible:ring-2` for keyboard users.
- Profile-form save messages now in a `role="status" aria-live="polite"`
  region.

### Performance
- `checkCartAvailability` is now O(b+i+s) (Map-indexed) instead of O(b×i×s).
- Self-hosted Arabic-subset Cairo + Tajawal via `next/font` (already in
  place pre-1.0; documented here).
- AVIF + WebP image variants via `next/image` with a 24h transform cache.

### Known limitations / deferred to v1.1
- Sandbox webhook end-to-end replay (P0-5) not yet executed — operator must
  run this before flipping production DNS.
- Real-money EGP-1 smoke test against `atfawry.com` (P1-10) likewise.
- Font Awesome still loaded via render-blocking `<link>` to cdnjs. Self-host
  in v1.1.
- Brand `primary` `#578e7e` (3.8:1 on white) fails WCAG AA for normal text.
  Decide between darkening the brand or restricting `text-primary` to large
  text/headings.
- Sentry / error-tracking integration not yet wired. Structured `lib/log.ts`
  emits JSON to Vercel's log stream; sufficient for v1.0.0 incident triage.

### Operator action items before deploy
1. `npm run db:push` to apply `supabase/migrations/022_atomic_return_receive.sql`.
2. Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel +
   `.env.local` so the rate limiter engages.
3. Reconfirm `CRON_SECRET`, `FAWRY_SECURE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   are set in Vercel production.
4. Run a Fawry-sandbox webhook replay (P0-5) and a production EGP-1 smoke
   test (P1-10) before flipping public DNS.
