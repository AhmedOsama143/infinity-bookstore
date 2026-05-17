# Fawry Integration — Roadmap

> Status snapshot: 2026-05-12. Source of truth for the plan itself is
> `docs/fawry/INTEGRATION_PLAN.md`. The pre-production issue audit lives in
> `roadmap/issues.md` — read both before shipping.

---

## Slice-by-slice status

| Slice | Status | Notes |
|---|---|---|
| 1 — Schema + migrations | Done | `019_fawry_payments.sql` extends the existing `orders` table (instead of recreating it) and adds `payment_events`. `020_fawry_order_idempotency.sql` adds the per-student idempotency key. |
| 2 — `POST /api/orders/create` | Done | Zod validation, server-side price recompute, cap enforcement, atomic stock reservation via migration-015 trigger, `Idempotency-Key` header, 72h `payment_expires_at`, stamps `merchant_ref_number = id`. |
| 3 — Signing + charge builder | Done | `lib/fawry/signing.ts`, `lib/fawry/client.ts`, `lib/fawry/types.ts`, `lib/fawry/config.ts`. 16-case unit suite passing. |
| 4 — Checkout page + JS plugin | Done | Checkout page, five-tile payment picker, env-aware plugin URL, signed payload returned to browser. |
| 5 — Webhook receiver | Done in code, untested in sandbox | Route + 12-case unit suite passing. Real ngrok-forwarded replay still owed — see Phase 1 below. |
| 6 — Result page | Partial stub | No polling, no PAYATFAWRY kiosk panel, no redirect-param signature verification. |
| 7 — Status polling fallback | Not started | No `GET /api/fawry/status/[merchantRefNumber]`. |
| 8 — Stock cleanup cron | Not started | `payment_expires_at` is written but never read. |
| 9 — Staff dashboard payments view | Not started | No `/admin/payments` surfacing `payment_events`. |
| 10 — Refunds | Not started | `signRefund` exists but no route or UI. |
| 11 — Production hardening | Not started | Still pointing at staging. |

---

# Release phases

The remaining work splits into four phases. Each phase has explicit
entry and exit criteria — **do not start phase N+1 until phase N's exit
criteria are all green**.

---

## Phase 1 — Sandbox certification (release blocker)

**Goal:** prove the integration we've built actually works against a real
Fawry sandbox, not just against our own unit tests.

**Entry criteria:** all green now — code is in, unit suites pass,
type-check clean.

**Work:**

1. **P0-5** — wire ngrok to `localhost:3000/api/fawry/webhook`, set the
   URL in the Fawry sandbox dashboard.
2. **P0-6** — decide whether `FAWRY_WEBHOOK_URL` is dashboard-driven or
   per-charge; remove or wire accordingly.
3. **P0-7** — commit, fold, or delete `scripts/seed-fawry-test.ts`.
4. Run three sandbox funnels end-to-end:
   - Card payment (success + decline).
   - Mobile wallet (Vodafone Cash sandbox push).
   - PAYATFAWRY reference, marked paid via sandbox dashboard.
5. For each funnel, capture the raw webhook payload into a new
   `docs/fawry/TEST_DATA.md`.
6. Replay one captured webhook → assert the second call is a no-op
   (idempotency).
7. Tamper one captured payload's `messageSignature` → assert the
   handler rejects and logs `signature_valid=false`.

**Exit criteria:**

- [ ] Three sandbox funnels each move an order from `pending` → `paid`.
- [ ] `payment_events` audit trail captured for each.
- [ ] Replay + tampered-signature tests pass.
- [ ] `docs/fawry/TEST_DATA.md` populated.
- [ ] `scripts/seed-fawry-test.ts` resolved.

---

## Phase 2 — Customer funnel correctness (must ship before public traffic)

**Goal:** close the data-integrity and UX gaps that would cause customer
support tickets or money loss within the first week of real traffic.

**Entry criteria:** Phase 1 exit criteria all green.

**Work (in order):**

1. **P0-1** — webhook compares `orderAmount` to `order.total`; mismatch
   = log + 200, no `paid` flip.
2. **P0-2** — webhook rejects orders where `payment_method !== 'fawry'`.
3. **P0-3** — webhook does not flip `payment_status=paid` when
   `order.status='cancelled'`.
4. **P0-4** — amounts parsed as strings; persisted via `toFawryAmount`.
5. **P1-1** — result-page client-side polling (2s × ~30s).
6. **P1-2** — PAYATFAWRY kiosk-instructions panel on the result page.
7. **P1-3** — wire `verifyChargeResponse` for any URL-derived display.

**Exit criteria:**

- [ ] Sandbox funnel re-run with all four P0 fixes in place still
      moves orders to `paid` correctly.
- [ ] Result page shows the "confirming" → "paid" transition without a
      manual refresh.
- [ ] PAYATFAWRY result page renders kiosk panel with reference number,
      72h countdown, copy-to-clipboard.
- [ ] An intentionally-tampered redirect URL is rejected.

---

## Phase 3 — Operational completeness (required for public launch)

**Goal:** the integration can survive a week of real traffic without
operator babysitting. Stock doesn't leak, stuck orders self-heal, staff
can answer support tickets, refunds are possible.

**Entry criteria:** Phase 2 exit criteria all green.

**Work:**

1. **Slice 8 / P1-4** — stock cleanup cron (Vercel Cron or Supabase
   scheduled function). Hourly; expires stale pending orders past
   `payment_expires_at`, releases reservation via `status='cancelled'`.
2. **Slice 7 / P1-5** — `GET /api/fawry/status/[merchantRefNumber]`;
   wired into the result-page poll-loop fallback.
3. **Slice 9 / P1-7** — `/admin/payments` staff dashboard: list +
   per-order `payment_events` timeline.
4. **Slice 10 / P1-6** — refund route + staff UI; refunds an existing
   sandbox paid order.

**Exit criteria:**

- [ ] Sandbox PAYATFAWRY order left unpaid is auto-cancelled within an
      hour of `payment_expires_at`; branch reservation is released.
- [ ] Sandbox order stuck in `pending` for >2h is reconciled to its
      actual Fawry status by the polling fallback.
- [ ] Staff can find any order in `/admin/payments` and see the full
      audit timeline.
- [ ] Staff can refund a sandbox paid order via the dashboard; the
      order flips to `refunded` and the event is logged.

---

## Phase 4 — Production hardening (gate to live money)

**Goal:** flip Fawry credentials from staging to production with
monitoring, alerting, and a verified real-money round-trip.

**Entry criteria:** Phase 3 exit criteria all green.

**Work:**

1. **P1-8** — rate limit `/api/fawry/webhook` (IP-based, plus IP
   allow-list once Fawry publishes their source ranges).
2. **P1-9** — structured JSON logging for the webhook and charge routes;
   correlation ID per request.
3. **P1-10** — staging Vercel deployment configured with production
   Fawry credentials; production webhook URL pinned in the Fawry
   dashboard.
4. Monitoring / alerts:
   - signature-mismatch rate > 0
   - webhook 5xx rate > 1%
   - orders stuck in `pending` for > 1h (excluding PAYATFAWRY)
   - `payment_events.processed=false` for > 5 min
5. Burst test the webhook endpoint (50 RPS for 10s) — must not 5xx.
6. **Real-money smoke test:** EGP-1 card payment, confirm webhook
   lands, confirm result page renders paid, refund via the staff UI,
   confirm refund webhook lands.

**Exit criteria:**

- [ ] Real-money round-trip complete and reconciled.
- [ ] All four monitors green for 24 hours of staged traffic.
- [ ] Runbook for "customer paid but order shows pending" written and
      stored alongside this file.
- [ ] DNS / Vercel env flipped to production Fawry.

---

## Phase 5 — Polish (optional, post-launch)

Address the P2 items in `roadmap/issues.md` as backlog. None of these
block launch; all improve operator quality of life or hardening depth.

- P2-1 — idempotency replay re-releases cart holds.
- P2-2 — plugin script load failure has a user-facing retry CTA.
- P2-3 — Fawry plugin SRI (if/when Fawry publishes a hash).
- P2-4 — webhook `paymentMethod` allow-list.
- P2-5 — idempotency key bound to cart hash, not component mount.
- P2-6 — result page surfaces fees breakdown.
- P2-7 — CSRF protection on mutating routes (or migrate to Server
  Actions).

---

## Cross-cutting reminders

- **The webhook is the only authoritative source of order state.**
  Never trust the redirect URL.
- **Money never flows through `number` in user code** — use
  `toFawryAmount` everywhere.
- **The plan in `docs/fawry/INTEGRATION_PLAN.md` is source of truth for
  slice scope.** This file tracks status; that file defines done.
- **Signature formulas live in `docs/fawry/SIGNING_REFERENCE.md`.** Any
  change to a signing helper must update both files together.
