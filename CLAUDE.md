# CLAUDE.md — Project Context for AI Coding Agents

> Read this file first on every session. It is the source of truth for how this project is built and what conventions to follow. If this file conflicts with anything you remember from training, this file wins.

---

## What this project is

An online bookstore for a library where students can browse, reserve, and purchase books. The site is bilingual-friendly (English/Arabic) and operates in Egypt, so all payment, currency, and locale concerns assume an Egyptian customer base.

There are two surfaces:

1. **Storefront** — public site for students to browse and check out
2. **Internal dashboard** — staff-only views for managing inventory, orders, refunds, and customer support

Both share the same Next.js codebase and the same Supabase backend.

---

## Tech stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes / Route Handlers + Supabase (Postgres + Auth + Edge Functions + Storage)
- **Payments:** Fawry (Egyptian payment gateway). See `docs/fawry/INTEGRATION_PLAN.md` for the full spec
- **Hosting:** Vercel (Next.js) + Supabase managed
- **Local dev:** Windows + PowerShell, Node 20+, pnpm
- **Webhook testing:** ngrok pointed at `localhost:3000`

---

## Folder layout (target)

```
/app                        # Next.js App Router
  /(storefront)             # public routes
    /checkout
    /orders/[id]
  /(dashboard)              # staff routes (auth-gated)
    /admin/orders
    /admin/payments
  /api
    /orders
      /create               # POST: create pending order from cart
    /fawry
      /charge               # POST: build signed Fawry charge request
      /webhook              # POST: Fawry server-to-server callback (PUBLIC, signature-verified)
      /status/[ref]         # GET: poll Fawry for transaction status
/lib
  /supabase
    /server.ts              # server-side Supabase client (service role)
    /browser.ts             # browser Supabase client (anon key)
  /fawry
    /client.ts              # Fawry HTTP client (charge, refund, status)
    /signing.ts             # SHA-256 signature builders (one per endpoint)
    /types.ts               # Charge requests, callbacks, enums
    /verify.ts              # Webhook signature verification
/docs
  /fawry
    INTEGRATION_PLAN.md     # The spec — read before touching payment code
    SIGNING_REFERENCE.md    # Field concatenation order per endpoint
    TEST_DATA.md            # Sandbox cards, wallets, ref numbers
/supabase
  /migrations               # SQL migrations
  /seed.sql
```

---

## Conventions and rules

### Secrets and security

- `FAWRY_SECURE_KEY`, `FAWRY_MERCHANT_CODE`, `SUPABASE_SERVICE_ROLE_KEY` are **server-only**. Never import them into a Client Component, never expose them via `NEXT_PUBLIC_*`, never log them.
- Anything that builds a Fawry charge request, computes a signature, or verifies a webhook lives in a Route Handler or Server Action — never in client code.
- The browser may know the merchant code (it's public-ish) but never the secure key.

### Source of truth for order state

- The **Fawry webhook** is the only authoritative source for marking an order paid, failed, or expired.
- The redirect-back-to-site after payment is for UX only — the success page reads order state from Supabase, never from the URL.
- If the webhook hasn't arrived yet when the user lands on the success page, show a "confirming payment" state and poll Supabase every 2-3 seconds for ~30 seconds before falling back to "we'll email you when it's confirmed."

### Idempotency

- Webhooks may be delivered more than once. Every webhook handler must be idempotent. Use the `merchantRefNumber` + `orderStatus` combination as the dedupe key.
- Log every webhook to `payment_events` before doing any business logic, so we have an audit trail even if processing fails.

### Money

- All amounts are stored in **EGP** as `numeric(12,2)` in Postgres. No floats anywhere.
- Fawry returns `orderAmount`, `paymentAmount`, and `fawryFees` separately. Store all three. `paymentAmount = orderAmount + fawryFees`.
- Never compute totals on the client. The server is authoritative; the client displays.

### Stock reservation

- When an order is created with status `pending`, decrement `books.available_stock` and record the reservation.
- If the order becomes `paid`, the reservation becomes permanent.
- If the order becomes `failed` or `expired`, restore the stock.
- Pay-at-Fawry references can take up to 72 hours to be paid. A scheduled job (Vercel cron, `0 3 */2 * *` — every two days at 03:00 UTC) expires stale pending orders past their `expires_at` and restores their stock. The cadence is constrained by the Hobby plan, which only permits daily-or-less crons; on Pro this can be tightened back toward hourly.

### Database access

- Use the **server client** (service role) only in API routes and Server Actions, never in components.
- Use the **browser client** (anon + RLS) for any data fetched from Client Components.
- All tables have RLS enabled. Customers can read their own orders only; staff role can read all.

### TypeScript

- Strict mode on. No `any` without a comment explaining why.
- All Fawry payloads have explicit types in `lib/fawry/types.ts`. Don't accept untyped JSON.
- Validate every external input (request bodies, webhook payloads, query params) with Zod.

### Errors and logging

- API routes return shape `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Never throw raw errors to the client.
- Log webhook payloads, signature mismatches, and any 4xx/5xx from Fawry to `payment_events`. We need this for support tickets.
- Don't log secure keys, card numbers, or full webhook bodies in plaintext to stdout — only to the encrypted `payment_events` table.

### Testing

- Every payment-touching function has a unit test. Signing functions especially — feed them the exact example payloads from Fawry's docs and assert the signature matches.
- Integration tests run against `atfawry.fawrystaging.com` (sandbox), never production.
- Webhook handler has a test that replays a real captured sandbox webhook payload.

### Commits and branches

- One vertical slice per branch (see `INTEGRATION_PLAN.md` for the slice list).
- Branch names: `feat/fawry-slice-N-short-name` (e.g. `feat/fawry-slice-3-charge-request`).
- Each PR includes the slice number and a checklist of what was tested in sandbox.

---

## Build order — do not skip ahead

The Fawry integration is built in numbered slices. Do not start slice N+1 until slice N is merged and tested in sandbox. The slices are listed in `docs/fawry/INTEGRATION_PLAN.md`.

If asked to "build the Fawry integration," ask which slice. Don't try to build them all at once.

---

## When unsure

- If a Fawry API detail isn't covered in `docs/fawry/INTEGRATION_PLAN.md` or `SIGNING_REFERENCE.md`, **ask before guessing**. The signature field order in particular is unforgiving — wrong order = every request rejected.
- If a Supabase pattern isn't established, prefer the simpler option and flag it in the PR for review.
- Default to writing less code, not more. Boring, explicit, and well-typed beats clever.
