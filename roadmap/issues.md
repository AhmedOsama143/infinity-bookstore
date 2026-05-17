# Fawry — Pre-Production Issue Audit

> Snapshot: 2026-05-12. Scope: every file under `lib/fawry/`,
> `app/api/fawry/`, `app/api/orders/`, `app/(storefront)/checkout/`,
> `components/cart/`, migrations `019` + `020`, and `scripts/fawry-*`.
> Severity: **P0** = release-blocker, **P1** = must fix before public launch,
> **P2** = nice-to-have / polish.

---

## P0 — Release blockers

### P0-1. Webhook does not verify `orderAmount` matches `order.total`
**File:** `app/api/fawry/webhook/route.ts:199-207`

The handler accepts whatever `paymentAmount` / `orderAmount` Fawry sends
and writes it straight to the `orders` row. There is no check against the
server-computed `order.total`. A Fawry-side bug, a compromised secure key,
or a webhook replay against a re-priced order could mark the order paid
for an amount lower than what we computed.

**Fix:** before mutating the row, compare
`toFawryAmount(notif.orderAmount) === toFawryAmount(Number(order.total))`.
On mismatch: log `amount_mismatch` to `payment_events`, do **not** flip
`payment_status` to `paid`, return 200, and surface to support.

---

### P0-2. Webhook does not assert the order is a Fawry order
**File:** `app/api/fawry/webhook/route.ts:147-152`

The order lookup is purely by `merchant_ref_number`. There is no check
that `order.payment_method === 'fawry'`. Collisions are extremely unlikely
given UUIDs, but a misconfigured webhook URL pointing at the wrong
environment could mark a non-Fawry order paid.

**Fix:** after loading the order, reject when
`order.payment_method !== 'fawry'` — log to `payment_events`, 200, no
mutation.

---

### P0-3. Late webhook can flip `payment_status` of a cancelled order to `paid`
**File:** `app/api/fawry/webhook/route.ts:191-230`

Only `payment_status` is checked for "already at target" idempotency.
If staff manually cancel an order via the dashboard before the Fawry
webhook lands, the webhook will still set `payment_status='paid'` while
`order.status='cancelled'` — an inconsistent state where stock has been
released but the customer is shown as paid.

**Fix:** if `notif.orderStatus === 'PAID'` and
`order.status === 'cancelled'`, skip the `paid` transition; log
`paid_after_cancel` and require manual reconciliation (likely a refund).

---

### P0-4. Money flowing through JavaScript numbers
**File:** `app/api/fawry/webhook/route.ts:206-207`,
`lib/fawry/types.ts:118-121`

`FawryServerNotificationV2.paymentAmount` is typed as `number`, parsed via
`z.number()`, and written into `DECIMAL(10,2)`. For bookstore amounts
this is empirically safe (EGP totals are small), but it violates the
project rule "no floats anywhere for money" (CLAUDE.md §Money). If Fawry
ever sends `1500.005` or similar, JS rounds it before the column does.

**Fix:** parse amounts via `z.union([z.number(), z.string()])`, normalise
through `toFawryAmount`, and persist as the two-decimal string. The
DECIMAL column accepts the string form.

---

### P0-5. Sandbox end-to-end webhook replay never executed
**File:** `docs/fawry/TEST_DATA.md` (missing),
`app/api/fawry/webhook/route.ts`

Unit tests for the pure helpers are passing (16 + 12 cases, see
"Regression results" below), but the route handler itself has never been
hit with a real ngrok-forwarded Fawry sandbox webhook. That is the slice 5
exit criterion in `INTEGRATION_PLAN.md`. Without it we don't know whether
Fawry's actual JSON shape (number vs string amounts, casing of
`orderStatus`, presence of optional fields) matches our Zod schema.
**Highest-risk unknown in the integration.**

**Fix:** boot ngrok → `localhost:3000/api/fawry/webhook`, point the Fawry
sandbox dashboard at it, run a EGP-10 sandbox card payment + a PAYATFAWRY
flow, capture the raw payloads into `docs/fawry/TEST_DATA.md`, replay each
once to confirm idempotency, and tamper one to confirm signature
rejection.

---

### P0-6. `FAWRY_WEBHOOK_URL` is read but not used
**File:** `lib/fawry/config.ts:63`

`getFawryConfig` reads the env var but no caller passes it as
`orderWebHookUrl` on the charge request (`lib/fawry/client.ts:52-63`).
Fawry sends the webhook to whatever URL is configured in the merchant
dashboard. If the dashboard is misconfigured we silently lose every
notification.

**Fix:** either delete the env var (rely on dashboard config only) or wire
it through `buildChargeRequest` as `orderWebHookUrl`, then sandbox-test
that Fawry honours the per-request override.

---

### P0-7. `scripts/seed-fawry-test.ts` is untracked
**File:** untracked in `git status`

If CI ever runs `npm run seed:fawry` (the package.json script exists), it
will fail. The file may also depend on test fixtures that aren't checked
in.

**Fix:** decide — commit it, fold its logic into `scripts/seed.ts`, or
remove the package.json entry.

---

## P1 — Must fix before public launch

### P1-1. Result page has no polling for late webhook arrival
**File:** `app/(storefront)/checkout/result/page.tsx`

Renders one static snapshot of `payment_status`. If the customer lands
before the webhook arrives (typical for wallet pushes), they see
"جارٍ تأكيد الدفع" and the page never updates — they have to refresh
manually or assume failure.

**Fix:** add a client component that polls the order row every 2s for
~30s while `payment_status === 'pending'`, then falls back to
"we'll email you" copy. (Slice 6 in the plan.)

---

### P1-2. PAYATFAWRY result-page instructions are missing
**File:** `app/(storefront)/checkout/result/page.tsx:74-79`

Currently the Fawry reference is shown as a single small line. Customers
who picked "pay at any Fawry kiosk" need the kiosk instructions, the 72h
expiry, and a copy-to-clipboard button on the reference number.

**Fix:** when `payment_method_detail === 'PAYATFAWRY'`, render a
dedicated panel: large reference number, "Go to any Fawry kiosk and
quote this number", expiry countdown.

---

### P1-3. Redirect-back URL is not signature-verified
**File:** `app/(storefront)/checkout/result/page.tsx`,
`lib/fawry/signing.ts:130-148`

`verifyChargeResponse` is implemented and unit-tested but never called.
The page sources state from Supabase (correct), but any URL-supplied
data shown to the user (e.g. a future "you paid X" UI) needs the
signature check before being trusted.

**Fix:** when slice 6 adds richer per-status copy, gate any URL-derived
display behind `verifyChargeResponse`.

---

### P1-4. PAYATFAWRY orders leak branch stock past expiry
**File:** `app/api/orders/create/route.ts:193`, no cron exists yet

`payment_expires_at` is written on creation, but nothing reads it. An
abandoned PAYATFAWRY order holds branch stock indefinitely (the
migration-015 trigger only releases on `order.status='cancelled'`, which
the webhook only flips on Fawry-reported FAILED/EXPIRED/CANCELED — Fawry
does not always send EXPIRED reliably).

**Fix:** ship slice 8 — Vercel Cron or Supabase scheduled function,
hourly, finds `payment_status='pending' AND payment_expires_at < now()`,
polls Fawry status once, then `UPDATE orders SET status='cancelled'`
if still unpaid. The migration-015 trigger then releases the
reservation.

---

### P1-5. No status-polling fallback when webhooks are delayed
**File:** `app/api/fawry/status/[ref]/route.ts` (not created)

Slice 7. Wallet payments are async; the redirect-back can land before the
webhook. Without a polling fallback the result page can't reconcile.

**Fix:** add `GET /api/fawry/status/[merchantRefNumber]` that calls
Fawry's status API (signed), reconciles the order, and is invoked from
the result-page poll loop after the 30s timeout.

---

### P1-6. No refund endpoint or staff UI
**Files:** `app/api/fawry/refund/route.ts` (missing),
`app/admin/payments/[id]/page.tsx` (missing)

`signRefund` is implemented and unit-tested but unreachable. If a
sandbox card pays through and we can't refund, slice 11 (real-money
smoke test) is blocked.

**Fix:** ship slice 10 — staff-only POST, builds signed refund request,
flips the order to `refunded`, logs `payment_events`.

---

### P1-7. No staff dashboard payments view
**File:** `app/(dashboard)/admin/payments/page.tsx` (missing)

There is no UI to inspect a `payment_events` audit row. When support
gets "I paid but it shows pending", staff have nothing to look at.

**Fix:** slice 9 — `/admin/payments` list + per-order timeline. Staff
role required.

---

### P1-8. Webhook handler has no rate limit
**File:** `app/api/fawry/webhook/route.ts`

Public endpoint with no rate limit. A malicious actor cannot mutate
state without a valid signature, but they can fill `payment_events` with
junk rows and exhaust the partial unique index. Mostly a cost / log
volume issue, but worth bounding.

**Fix:** Vercel Edge middleware rate limit by IP (e.g. 60 req/min),
allow-list Fawry's source IPs once we have them.

---

### P1-9. No structured logging
**File:** `app/api/fawry/webhook/route.ts:80, 87, 99, 134`

All webhook diagnostics go through `console.error(...)` with free-text
prefixes. Vercel captures them, but there is no correlation ID, no
machine-readable event type, no metric. For an integration whose
debugging steps almost always start with "what did Fawry send us?"
this is too thin.

**Fix:** introduce a tiny `lib/log.ts` that JSON-stringifies
`{ level, area, event, merchantRefNumber, ...rest }`. Vercel parses
JSON logs into queryable columns.

---

### P1-10. Production base URL switching is wired but untested
**File:** `lib/fawry/config.ts:50-65`

`FAWRY_ENV=production` flips both the API base URL and the plugin JS URL.
There is no staged smoke test against `atfawry.com` (slice 11). Going
live without a EGP-1 real-money round-trip and refund is reckless.

**Fix:** execute slice 11 end-to-end on a staging Vercel deployment with
production Fawry credentials, before flipping the public DNS.

---

## P2 — Polish, can ship without

### P2-1. Idempotency replay path doesn't re-release cart holds
**File:** `app/api/orders/create/route.ts:110-127`

The success path calls `releaseAllHoldsForUser` at the end. The
idempotency replay returns early and skips it. Effect: a retry within the
soft-hold window leaves the cart hold alive until it naturally expires.
Minor.

**Fix:** `void releaseAllHoldsForUser(user.id).catch(() => {})` inside
the replay block too.

---

### P2-2. Plugin script load failure has no user-facing error
**File:** `lib/fawry/use-fawry-script.ts:60-62`

When `script.onerror` fires the only signal is `console.error`. The
checkout button stays permanently disabled (`fawryReady === false`) with
no explanation.

**Fix:** add a third state (`'loading' | 'ready' | 'error'`) and surface
a retry CTA when `error`.

---

### P2-3. No subresource integrity on Fawry plugin script
**File:** `lib/fawry/use-fawry-script.ts:56-58`

Loading remote JS from `atfawry.com` without an `integrity=` attribute.
A CDN compromise becomes a checkout compromise. Fawry doesn't publish a
hash, so SRI may be impractical — flagging for awareness.

---

### P2-4. `payment_method_detail` stored verbatim from webhook
**File:** `app/api/fawry/webhook/route.ts:204`

No allow-list against `FawryPaymentMethod`. If Fawry adds a new method
the staff UI will render whatever string they sent.

**Fix:** validate against the union in `lib/fawry/types.ts` and stash
unknown values in `error_message` for triage.

---

### P2-5. Idempotency key tied to component mount, not cart
**File:** `components/cart/checkout-view.tsx:77-81`

A user who places a pending order, navigates away, returns, and clicks
checkout again gets a fresh key — and a fresh order. The first order is
left orphaned until the cleanup cron runs.

**Fix:** derive key from a cart-content hash, or persist it in
sessionStorage keyed by user id.

---

### P2-6. Result page doesn't surface fees paid
**File:** `app/(storefront)/checkout/result/page.tsx:97-102`

Only `order.total` is shown. The customer paid `order.total + fawry_fees`,
and `fawry_fees` is recorded on the row but not rendered.

**Fix:** when `payment_amount > total`, show the breakdown.

---

### P2-7. No CSRF token on mutating routes
**Files:** `app/api/orders/create/route.ts`,
`app/api/fawry/charge/route.ts`

Cookie-authenticated POSTs with no origin / CSRF check. A malicious site
could trigger `/api/orders/create` against a logged-in user. The blast
radius is limited (the user still has to complete payment), but a
mischievous order with their email in the notes field is still
exploitable for spam.

**Fix:** validate `Origin`/`Referer` against an allow-list, or move to
Next.js Server Actions (CSRF-protected by default).

---

## Regression results (2026-05-12)

| Check | Result |
|---|---|
| `npx tsx scripts/fawry-signature.test.ts` | **16/16 passed** |
| `npx tsx scripts/fawry-webhook.test.ts` | **12/12 passed** |
| `npx tsc --noEmit` | **Clean** (no errors) |
| Sandbox end-to-end webhook replay | **Not executed** — see P0-5 |
| Sandbox card-payment funnel | **Not executed** — needs ngrok + dashboard config |
| Sandbox PAYATFAWRY funnel | **Not executed** — same |
| Real-money EGP-1 smoke test | **Not executed** — slice 11 not started |

**Verdict:** static + unit checks are green. The integration is **not
ready for production traffic** until P0-1 through P0-7 are resolved and
the three sandbox funnels above pass end-to-end.
