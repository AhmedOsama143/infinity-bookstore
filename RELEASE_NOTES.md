# Release Notes — v1.0.0

**Prepared:** 2026-05-31 · **Last reconciled:** 2026-06-08 (delta pass) · **Status:** ready to tag, awaiting operator sign-off (see Go / no-go)
**Stack:** Next.js 15.5 · React 19 · TypeScript (strict) · Tailwind 3 · Supabase · Fawry · Vercel
**Audience:** product owner, ops, support, QA.

> **Re-audit addendum (2026-05-31).** After the original audit closed, a search
> feature landed and a second full Phase 2–10 pass was run (payments explicitly
> **out of scope** this round). Net delta: Arabic-normalized search (migration
> 023) + screen-reader result announcements; security headers (HSTS, X-Frame,
> nosniff, Referrer-Policy, Permissions-Policy); CSV formula-injection guard on
> the admin export; `postcss` CVE cleared (`npm audit` = 0, now CI-gated);
> internal search results set `noindex`; search RPC failures now logged; admin
> branch-manager removal made atomic; **test suite 31 → 57**. See
> `RELEASE_AUDIT.md` (Re-Phase sections) for the full ledger.

---

## What's in v1.0.0

### Customer-facing storefront
- Bilingual-aware Arabic RTL site for Egyptian secondary-school students.
- Browse → cart → checkout with Fawry online payment **or** cash on delivery.
- Per-branch inventory across 3 branches (Tamlik, El-Geish, Sidi Bishr / escott).
- Pickup or delivery, free shipping over EGP 2,500, per-student 10-book cap.
- Account: profile, orders (with payment status timeline), notifications, wishlist.
- Arabic-aware search (folds alif/ya/ta-marbuta variants, strips tashkeel; books
  also match by teacher name), grade-level browsing, teacher profiles, branch
  locator with map deep-links.
- Legal pages (privacy, terms, refund, shipping) editable from the admin dashboard.

### Admin dashboard
- Orders (with manual creation, per-branch scope for branch managers, audit-logged transitions).
- Books (CRUD + CSV bulk import + per-branch stock).
- Teachers, branches, promos, shipping rates, returns, reviews, transfers.
- Payments view of every Fawry transaction with timeline + refund flow.
- Settings (announcement bar, content blocks, branch-manager invitation).

### Payments (Fawry)
- 11 vertical slices shipped: order creation, charge signing, plugin checkout, webhook with signature verification + idempotency + amount-mismatch + cancelled-order guards, result page with live polling, status-poll fallback, refund endpoint, expire-orders cron (every two days), staff payments dashboard, structured logging, rate limiting.
- Migration `019` adds the partial unique index on `payment_events` for webhook dedupe.
- Migration `022` adds the atomic `mark_return_received` RPC so concurrent return processing can't lose-update stock.

### Stock integrity
- Four-phase rollout: customer block + staff oversell + 15-minute cart holds + atomic claim + back-in-stock CTA.
- All inventory mutations go through migration `015`/`017` triggers, never via JS reads.

### Infrastructure
- `vercel.json` runs `/api/cron/expire-orders` every two days (`0 3 */2 * *`) — constrained by the Vercel Hobby plan (daily-or-less crons). On Pro this can be tightened back toward hourly. A stale `PAYATFAWRY` reservation can therefore hold branch stock up to ~48h past `payment_expires_at` before the sweep releases it.
- `/api/health` for monitor probes.
- Upstash sliding-window rate limiter wired into the Fawry webhook (60 req/min/IP).
- Structured `lib/log.ts` JSON logger for Vercel-queryable diagnostics.
- Vitest + Playwright test infrastructure with **57** passing unit tests (incl.
  the search glue, formatting, and SVG-escaping helpers) and a GitHub Actions CI
  workflow (install · lint · type-check · test · **security audit** · build · E2E).

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
| Idempotency-key for checkout regenerates per component mount. | Reliability (minor) | A user who navigates away and returns gets a new key; old order is reaped by the expire-orders cron. v1.1 will derive the key from a cart-content hash. |

---

## Upgrade notes — pre-deploy checklist

Before flipping production DNS / pointing customers at this build, an operator must:

### 1. Apply pending database migration

```bash
npm run db:push
```

This pushes the two pending migrations:
- `022_atomic_return_receive.sql` — required for the `markReturnReceived` flow. Without it, staff clicking "received" on a return will error out at runtime.
- `023_arabic_search_normalization.sql` — the search feature's `normalize_ar()` function + RPCs and indexes. **Without it, search silently returns no results** (now surfaced as a `search/*_rpc_failed` log line, but still broken for customers).

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
- `CRON_SECRET` (any sufficiently-random string; Vercel will send it as `Authorization: Bearer …` to the every-two-days cron)
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

**Recommendation: split decision — GO for the non-payment storefront/admin;
conditional NO-GO for online (Fawry) payments until their open P0s are closed.**

This re-audit (2026-05-31) re-ran Phases 2–10 across everything **except the
Fawry payment path**, which the product owner placed out of scope for this round.
What that pass covered is in good shape:

- **Storefront (browse, search, cart, account), admin dashboard, auth, a11y,
  SEO, performance, observability, release hygiene** were re-verified and, where
  needed, hardened. Authz is enforced on every route and mutating action; `npm
  audit` is clean and CI-gated; security headers are in place; the new search
  feature is tested, indexed, accessible, and `noindex`-correct. Build/lint/
  type-check/tests are all green (57 tests).

**The payments caveat — read before shipping with online payment enabled.**
The `roadmap/issues.md` snapshot (2026-05-12) listed **7 P0 release-blockers**
for Fawry. Six of those seven are **code-level guards that have since been
implemented and re-verified against current source** (see `RELEASE_AUDIT.md`
Phase 1 re-verification and the 2026-06-08 delta pass):

- P0-1 amount-match verification — `app/api/fawry/webhook/route.ts:238-257` ✅
- P0-2 fawry-order assertion — `route.ts:194-208` ✅
- P0-3 paid-after-cancel guard — `route.ts:259-273` ✅
- P0-4 money-as-string (no floats) — `FawryAmount` union + `toFawryAmount` ✅
- P0-6 webhook-URL wired to charge — `lib/fawry/client.ts` ✅
- P0-7 seed script tracked in git ✅

What genuinely remains for online payments is **operational, not code**:

- **P0-5** — the end-to-end Fawry **sandbox** webhook replay has never been run.
- **P1-10** — the **EGP-1 real-money** production smoke test has never been run.

Both are rehearsals an operator must perform against ngrok + the Fawry dashboard
(and, for P1-10, a real card on a staging deploy with production credentials);
they cannot be executed from the repo. The webhook handler itself is signature-
verified, idempotent (migration 019 unique index), amount-checked, and rate-
limited — but **no online-payment round-trip has been exercised against this
build**, which is why payments stay a conditional NO-GO until the rehearsals pass.

### Decision matrix

| Launch shape | Verdict |
|---|---|
| **Storefront + admin, cash-on-delivery only** (Fawry online payment gated off) | **GO** once the operator items below are done. |
| **Storefront + admin with Fawry online payment enabled** | **NO-GO** until the **P0-5 sandbox replay and P1-10 real-money smoke test pass.** (The six code-level Fawry P0s are already implemented and re-verified — see the payments caveat above; the gate is now the two operational rehearsals, not unfixed code.) |

### Operator items (apply to either shape)

1. **`npm run db:push`** — apply migrations **022 and 023** (023 = search; without it search silently returns nothing).
2. **Set Upstash creds** in Vercel before the production webhook receives traffic.
3. **Confirm all `.env.example` vars** are set in Vercel production.
4. **Contrast decision (A-10/A-11):** ship as-is (defer to v1.1) or sweep the palette — product-owner call if AA is contractual.
5. **Recommended before public launch:** a CSP pass (S-35) and a Lighthouse/axe-core run on a preview deploy — both need a deployment the audit can't perform.

If launching with online payments, additionally complete the P0-5 / P1-10 sandbox + real-money rehearsals (ngrok + Fawry dashboard + a real card — operator-only). The six code-level Fawry P0s are already implemented and re-verified, so no further payment-code remediation is required before those rehearsals.

---

## Tag

Version is bumped to `1.0.0` in `package.json`. The git tag has **not** been created — that's a destructive operation reserved for the operator's explicit sign-off after the conditions above are met. To tag and push:

```bash
git tag -a v1.0.0 -m "Release v1.0.0 — Infinity Bookstore"
git push origin v1.0.0
```
