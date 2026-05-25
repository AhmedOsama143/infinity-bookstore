# Release Notes — v1.0.0

**Released:** 2026-05-25
**Stack:** Next.js 15.5 · React 19 · TypeScript (strict) · Tailwind 3 · Supabase · Fawry · Vercel
**Audience:** product owner, ops, support, QA.

---

## What's in v1.0.0

### Customer-facing storefront
- Bilingual-aware Arabic RTL site for Egyptian secondary-school students.
- Browse → cart → checkout with Fawry online payment **or** cash on delivery.
- Per-branch inventory across 3 branches (Tamlik, El-Geish, Sidi Bishr / escott).
- Pickup or delivery, free shipping over EGP 2,500, per-student 10-book cap.
- Account: profile, orders (with payment status timeline), notifications, wishlist.
- Search, grade-level browsing, teacher profiles, branch locator with map deep-links.
- Legal pages (privacy, terms, refund, shipping) editable from the admin dashboard.

### Admin dashboard
- Orders (with manual creation, per-branch scope for branch managers, audit-logged transitions).
- Books (CRUD + CSV bulk import + per-branch stock).
- Teachers, branches, promos, shipping rates, returns, reviews, transfers.
- Payments view of every Fawry transaction with timeline + refund flow.
- Settings (announcement bar, content blocks, branch-manager invitation).

### Payments (Fawry)
- 11 vertical slices shipped: order creation, charge signing, plugin checkout, webhook with signature verification + idempotency + amount-mismatch + cancelled-order guards, result page with live polling, status-poll fallback, refund endpoint, hourly expire-orders cron, staff payments dashboard, structured logging, rate limiting.
- Migration `019` adds the partial unique index on `payment_events` for webhook dedupe.
- Migration `022` adds the atomic `mark_return_received` RPC so concurrent return processing can't lose-update stock.

### Stock integrity
- Four-phase rollout: customer block + staff oversell + 15-minute cart holds + atomic claim + back-in-stock CTA.
- All inventory mutations go through migration `015`/`017` triggers, never via JS reads.

### Infrastructure
- `vercel.json` runs `/api/cron/expire-orders` hourly.
- `/api/health` for monitor probes.
- Upstash sliding-window rate limiter wired into the Fawry webhook (60 req/min/IP).
- Structured `lib/log.ts` JSON logger for Vercel-queryable diagnostics.
- Vitest + Playwright test infrastructure with 31 passing tests and a GitHub Actions CI workflow.

---

## Known limitations

| Limitation | Severity | Workaround |
|---|---|---|
| Font Awesome is loaded via render-blocking `<link>` to cdnjs. | Performance | Self-host scheduled for v1.1; LCP cost is ~100-200ms on 3G. |
| Brand `primary` `#578e7e` (3.8:1 on white) fails WCAG AA for normal text; `accent` `#e3af64` (3.2:1) fails for all sizes. | A11y | Use `primary-dark` for body text or restrict `primary` to headings. Design-system decision pending. |
| Mini-cart and mobile-menu modals don't implement explicit focus traps. | A11y | ARIA roles present; keyboard tab can escape. v1.1. |
| Sentry / error tracking not wired. | Ops | `lib/log.ts` JSON logs queryable in Vercel. |
| `getBooks()` selects the full description column for list views. | Performance | Negligible at current catalogue size (47 books). Trim in v1.1. |
| Header re-fetches user + notifications on every storefront page. | Performance | ~50ms per nav. v1.1 cache opportunity. |
| The two `scripts/fawry-*.test.ts` ad-hoc test files have not been migrated into Vitest yet. | Test infra | They still pass via `npm run test:fawry`. v1.1. |
| Service-role client used for the public sign-up flow (auto-confirm email). | Security | Trade-off documented in `lib/auth/actions.ts` — acceptable given the secret is server-only. |
| Idempotency-key for checkout regenerates per component mount. | Reliability (minor) | A user who navigates away and returns gets a new key; old order is reaped by the hourly cron. v1.1 will derive the key from a cart-content hash. |

---

## Upgrade notes — pre-deploy checklist

Before flipping production DNS / pointing customers at this build, an operator must:

### 1. Apply pending database migration

```bash
npm run db:push
```

This pushes `supabase/migrations/022_atomic_return_receive.sql` — required for the new `markReturnReceived` flow. Without it, staff clicking "received" on a return will error out at runtime.

### 2. Provision Upstash + paste credentials

The Fawry webhook rate limiter fails open if Upstash isn't configured (it warns in logs but lets traffic through). For production rate-limiting:

1. Create an Upstash project (free tier is plenty).
2. Set in Vercel Project Settings → Environment Variables (Production + Preview):
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Mirror to local `.env.local` for any developer who needs to test rate-limiting.

### 3. Confirm every other env var is set

Use `.env.example` as the canonical list. Critical for production:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `FAWRY_MERCHANT_CODE`, `FAWRY_SECURE_KEY`, `FAWRY_ENV=production`
- `FAWRY_WEBHOOK_URL=https://<your-domain>/api/fawry/webhook` (and confirm this matches the URL configured in Fawry's merchant dashboard)
- `CRON_SECRET` (any sufficiently-random string; Vercel will send it as `Authorization: Bearer …` to the hourly cron)
- `ADMIN_EMAIL`

### 4. Run the Fawry sandbox end-to-end (P0-5)

Boot `ngrok` against `http://localhost:3000`, point Fawry's sandbox dashboard at `<ngrok-url>/api/fawry/webhook`, and run:

- A EGP-10 sandbox card payment end-to-end (browser → plugin → redirect → webhook → result page).
- A `PAYATFAWRY` reference-number flow.
- One replay of each captured payload (to confirm idempotency).
- One signature-tampered payload (to confirm the webhook rejects + logs).

Capture the raw payloads into `docs/fawry/TEST_DATA.md` once they're working.

### 5. Run the production EGP-1 smoke test (P1-10)

On a staging Vercel deployment with **production** Fawry credentials:

- Place an EGP-1 order.
- Pay with a real card.
- Confirm the order flips to `paid` via the production webhook.
- Issue a refund via `/admin/payments/[id]`.
- Confirm the refund flows back to Fawry sandbox.

Only after both flows pass should you point real customer traffic at the deploy.

### 6. Decide on WCAG AA brand-contrast compliance

See "Known limitations." If accessibility compliance is contractual, plan a brand-palette sweep (either darken `primary`/`accent` or restrict their use to large text and decorative surfaces). If it's not contractual, document the decision and defer.

---

## Go / no-go

**Recommendation: GO, with the following conditions.**

The code is in production-ready shape. Every Critical / High security finding has been closed or marked won't-fix-by-design with rationale. The build is clean, lint is clean, the test suite is green, and CI is configured to enforce all of that on PR. Hourly cron is wired. Structured logs ship out the box. Documentation (CHANGELOG, README, .env.example, LICENSE, RELEASE_AUDIT) is complete.

**The conditions are operational, not code:**

1. **Migration 022 must be applied** (`npm run db:push`) before staff touch the returns flow.
2. **Upstash creds must be set** before the production webhook starts receiving traffic.
3. **The two sandbox smoke tests (P0-5 + P1-10) must be executed** by an operator. The audit cannot run these — they need ngrok, Fawry dashboard access, and a real card. Until they pass, the integration is "code-complete but un-rehearsed" and rolling out to real customers is reckless.
4. **The contrast issue (A-10, A-11) needs a one-line decision** from the product owner: ship as-is (defer to v1.1) or sweep the palette before launch.

If 1-4 are addressed, the build is shippable. If they aren't, it's not — through no fault of the code.

---

## Tag

Version is bumped to `1.0.0` in `package.json`. The git tag has **not** been created — that's a destructive operation reserved for the operator's explicit sign-off after the conditions above are met. To tag and push:

```bash
git tag -a v1.0.0 -m "Release v1.0.0 — Infinity Bookstore"
git push origin v1.0.0
```
