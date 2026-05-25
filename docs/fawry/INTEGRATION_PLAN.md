# Fawry Integration Plan

> **Audience:** humans and AI coding agents working on this repo.
> **Goal:** integrate Fawry as the payment gateway for the bookstore, supporting cards, all major Egyptian wallets (Vodafone Cash, Orange Cash, Etisalat Cash, We Pay), Pay-at-Fawry reference numbers, and InstaPay where available.
> **Approach:** Fawry's Checkout Button (self-hosted JS plugin) for the customer-facing flow, plus server-to-server APIs for status polling, refunds, and webhooks.

---

## 1. Why Fawry, and what we get

Fawry is a single integration that bundles every Egyptian payment method customers expect:

- **Cards** — Visa, Mastercard, Meeza
- **Mobile wallets** — Vodafone Cash, Orange Cash, Etisalat Cash, We Pay, bank wallets (via QR or push notification to wallet app)
- **Pay-at-Fawry** — customer gets a reference number, pays cash at any of 250k+ Fawry kiosks. Critical for students without cards.
- **valU** installments
- **myFawry** in-app wallet
- **InstaPay** (where enabled on merchant account)

We pick which methods are enabled in the Fawry merchant dashboard. We do not write per-wallet code — Fawry handles the routing.

---

## 2. Integration shape

We use **Checkout Button (self-hosted)**:

- Customer checks out on our site.
- Our backend builds a signed `chargeRequest` and returns it to the browser.
- Our frontend invokes Fawry's JS library, which opens a Fawry-styled modal on top of our checkout page.
- Customer picks payment method and pays inside the modal.
- Fawry redirects back to our `returnUrl` (browser, for UX) **and** POSTs to our `serverCallbackUrl` (server, authoritative).
- We update the order in Supabase based on the server callback.

Why not Checkout Link (hosted redirect)? Slightly worse UX — full page redirect away from the site.
Why not full server-to-server? More work, more PCI surface, no real benefit for a bookstore.

---

## 3. End-to-end flow

```
[Browser]                    [Our Backend]              [Supabase]            [Fawry]
   │                              │                         │                    │
   │  createFawryOrderAction()    │                         │                    │
   │  (server action, CSRF-safe)  │                         │                    │
   ├─────────────────────────────►│                         │                    │
   │                              │  insert pending order   │                    │
   │                              ├────────────────────────►│                    │
   │                              │  reserve stock          │                    │
   │                              ├────────────────────────►│                    │
   │  { orderId, refNumber }      │                         │                    │
   │◄─────────────────────────────┤                         │                    │
   │                              │                         │                    │
   │  getFawryChargePayloadAction()                         │                    │
   │  (server action, CSRF-safe)  │                         │                    │
   ├─────────────────────────────►│                         │                    │
   │                              │  build signed payload   │                    │
   │                              │  (no Fawry call yet —   │                    │
   │                              │   Checkout Button JS    │                    │
   │                              │   triggers it)          │                    │
   │  { chargeRequest }           │                         │                    │
   │◄─────────────────────────────┤                         │                    │
   │                              │                         │                    │
   │  FawryPay.checkout(...)      │                         │                    │
   ├──────────────────────────────┼─────────────────────────┼───────────────────►│
   │                              │                         │                    │
   │                              │                         │                    │ customer
   │                              │                         │                    │ pays
   │                              │                         │                    │
   │  redirect to returnUrl       │                         │                    │
   │◄─────────────────────────────┼─────────────────────────┼────────────────────┤
   │                              │                         │                    │
   │                              │  POST /api/fawry/webhook (server callback)   │
   │                              │◄────────────────────────┼────────────────────┤
   │                              │  verify signature       │                    │
   │                              │  update order → paid    │                    │
   │                              ├────────────────────────►│                    │
   │                              │  log payment_event      │                    │
   │                              ├────────────────────────►│                    │
   │                              │                         │                    │
   │  GET /orders/[id]            │                         │                    │
   ├─────────────────────────────►│                         │                    │
   │                              │  read order status      │                    │
   │                              ├────────────────────────►│                    │
   │  show success page           │                         │                    │
   │◄─────────────────────────────┤                         │                    │
```

**Critical:** the success page reads from Supabase, not from URL params. If the webhook is slow, show a "confirming" state and poll.

---

## 4. Database schema

```sql
-- orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  merchant_ref_number text unique not null,        -- our id sent to Fawry
  fawry_ref_number text,                            -- Fawry's id, set on first webhook
  status text not null default 'pending'            -- pending | paid | failed | expired | refunded
    check (status in ('pending','paid','failed','expired','refunded')),
  payment_method text,                              -- CARD | MWALLET | PAYATFAWRY | VALU | etc.
  order_amount numeric(12,2) not null,              -- what customer owes us
  fawry_fees numeric(12,2) default 0,
  payment_amount numeric(12,2),                     -- order_amount + fawry_fees
  currency text not null default 'EGP',
  customer_name text,
  customer_email text,
  customer_mobile text,
  expires_at timestamptz,                           -- for PAYATFAWRY references
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);

create index orders_user_id_idx on orders(user_id);
create index orders_status_idx on orders(status);
create index orders_expires_at_idx on orders(expires_at) where status = 'pending';

-- order_items
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  book_id uuid not null references books(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on order_items(order_id);

-- payment_events (audit log of every webhook + Fawry API call)
create table payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  merchant_ref_number text,
  event_type text not null,                         -- webhook | charge_request | refund | status_poll
  raw_payload jsonb not null,
  signature_provided text,
  signature_valid boolean,
  fawry_status_code text,
  processed boolean default false,
  error_message text,
  received_at timestamptz not null default now()
);

create index payment_events_order_id_idx on payment_events(order_id);
create index payment_events_merchant_ref_idx on payment_events(merchant_ref_number);

-- RLS
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payment_events enable row level security;

-- Customers see only their own orders
create policy "users read own orders" on orders
  for select using (auth.uid() = user_id);

create policy "users read own order items" on order_items
  for select using (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
  );

-- Staff role bypass (set via custom claim or separate staff table — TBD)
-- payment_events: no policies → only service role can read/write
```

---

## 5. Environment variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Fawry — sandbox
FAWRY_BASE_URL=https://atfawry.fawrystaging.com
FAWRY_MERCHANT_CODE=
FAWRY_SECURE_KEY=
FAWRY_RETURN_URL=http://localhost:3000/checkout/result
FAWRY_WEBHOOK_URL=https://your-ngrok.ngrok-free.app/api/fawry/webhook

# Fawry — production (set in Vercel only, never in .env.local)
# FAWRY_BASE_URL=https://www.atfawry.com
```

---

## 6. The signature — read this carefully

Every Fawry request needs a SHA-256 signature. **The order of concatenated fields is fixed and different per endpoint.** Wrong order = request rejected with no useful error message. This is the #1 source of integration bugs.

### Charge request signature

Concatenate, in this order, then SHA-256 hex:

```
merchantCode + merchantRefNum + customerProfileId (or empty) + paymentMethod (or empty)
+ amount (with 2 decimals, e.g. "150.00")
+ for each chargeItem in order: itemId + quantity + price (with 2 decimals)
+ secureKey
```

### Server callback (webhook) signature verification

Fawry sends `messageSignature`. Compute SHA-256 of:

```
fawryRefNumber + merchantRefNumber + paymentAmount (2dp) + orderAmount (2dp)
+ orderStatus + paymentMethod + paymentReferenceNumber (or empty) + secureKey
```

Compare hex strings (case-insensitive). If mismatch → reject the webhook, log it as `signature_valid: false`, return 200 anyway (so Fawry doesn't retry forever) but **do not** update the order.

### Refund signature

```
merchantCode + fawryRefNumber + refundAmount (2dp) + reason (or empty) + secureKey
```

> **Always cross-check the exact order against the current Fawry docs in `docs/fawry/SIGNING_REFERENCE.md` before implementing. The docs are the source of truth, not this summary.**

---

## 7. Build slices

Each slice is a separate branch and PR. Don't start slice N+1 until N is merged and tested in sandbox.

### Slice 1 — Schema + migrations
- Apply the SQL above as a migration in `supabase/migrations/`.
- Seed a few test books with stock.
- **Done when:** `pnpm supabase db reset` recreates the schema cleanly and seed data loads.

### Slice 2 — Order creation (server action)
- `createFawryOrderAction({ items, branch_id, fulfillment, shipping?, notes?, idempotency_key? })` in `lib/cart/fawry-checkout-actions.ts`.
- Validates with Zod, checks stock, creates `orders` row with `status='pending'`, creates `order_items`, decrements `books.available_stock`.
- Returns `{ ok: true, data: { orderId, merchantRefNumber, totalAmount } }` or `{ ok: false, error: { code, message } }`.
- Atomic: use a Postgres transaction or RPC.
- Originally lived at `POST /api/orders/create`; migrated to a server action in P2-7 so the cookie-authed POST is CSRF-safe by default. The route handler has been deleted.
- **Done when:** integration test creates an order, verifies stock decreased, and a duplicate request with the same idempotency key returns the same order.

### Slice 3 — Fawry signing + charge request builder
- `lib/fawry/signing.ts` exports `signChargeRequest(payload, secureKey)`, `verifyCallback(payload, secureKey)`, `signRefund(payload, secureKey)`.
- `lib/fawry/client.ts` exports `buildChargeRequest(order)` returning the payload the frontend hands to FawryPay JS.
- Unit tests: feed in the exact example from Fawry docs, assert signature matches their published example.
- **Done when:** unit tests pass for all three signing functions against published test vectors.

### Slice 4 — Checkout page + Fawry JS button
- Storefront `/checkout` page: shows cart, customer info form (name, email, mobile — required by Fawry).
- On submit: calls `createFawryOrderAction(...)`, then `getFawryChargePayloadAction(orderId, method)` to get the signed payload, then invokes `FawryPay.checkout(payload)` from Fawry's JS library.
- Loads the staging JS library in dev, production library in prod.
- **Done when:** a sandbox card payment completes end-to-end and the browser is redirected to the result page.

### Slice 5 — Webhook receiver
- `POST /api/fawry/webhook` is **public** (no auth) but signature-verified.
- Steps in order: (1) log raw payload to `payment_events`, (2) verify signature, (3) load order by `merchantRefNumber`, (4) idempotency check (skip if order is already in the target status), (5) update order status, payment_method, fawry_ref_number, paid_at, fees, (6) commit/release stock based on final status, (7) mark `payment_events.processed = true`, (8) return 200.
- Handles statuses: `NEW`, `PAID`, `DELIVERED`, `CANCELED`, `REFUNDED`, `EXPIRED`, `FAILED`.
- Returns 200 even on signature failure (to prevent Fawry retry storms) but does not update the order.
- **Done when:** ngrok-forwarded sandbox webhook updates the order, replaying the same webhook is a no-op, and an invalid signature is logged but rejected.

### Slice 6 — Result page + status reconciliation
- `/checkout/result?orderId=...` reads order from Supabase (browser client, RLS-gated).
- If `paid` → show success + email confirmation.
- If `pending` → show "confirming payment" + poll every 2s for 30s, then fall back to "we'll email you."
- If `pending` and method is `PAYATFAWRY` → show the Fawry reference number and instructions ("Go to any Fawry kiosk and quote this number, you have 72 hours").
- If `failed` or `expired` → show retry CTA.
- **Done when:** all four states render correctly with sandbox data.

### Slice 7 — Status polling fallback
- `GET /api/fawry/status/[merchantRefNumber]` calls Fawry's status API as a fallback when webhooks are delayed.
- Used by the result page after the 30s poll timeout, and by a daily reconciliation cron for any pending orders older than 2 hours.
- Same signature verification rules.
- **Done when:** stale `pending` orders that Fawry reports as paid get reconciled within an hour.

### Slice 8 — Stock cleanup cron
- Supabase scheduled function (or Vercel Cron) runs every hour.
- Finds `orders` where `status='pending' AND expires_at < now()`.
- Polls Fawry status one last time. If still unpaid → mark `expired`, restore stock, log event.
- **Done when:** an expired sandbox PAYATFAWRY order has its stock restored within an hour of expiry.

### Slice 9 — Staff dashboard: payments view
- `/admin/payments` lists all orders with filters (status, date, payment method).
- Click into an order → see full timeline from `payment_events`.
- Staff role required (RLS + middleware check).
- **Done when:** staff can view, filter, and inspect any order without seeing other customers' data leak across rows.

### Slice 10 — Refunds
- `POST /api/fawry/refund` (staff-only): builds signed refund request, calls Fawry, updates order to `refunded` on success, logs event.
- "Refund" button in the staff dashboard with a confirmation modal and reason field.
- **Done when:** a sandbox paid order can be refunded, the order status updates, and the refund event is logged.

### Slice 11 — Production hardening
- Switch base URL and JS library to production.
- Set production webhook URL in Fawry dashboard.
- Add monitoring: alert on signature mismatches, webhook 5xx rate, orders stuck in `pending` > 1 hour.
- Load test the webhook endpoint (Fawry can burst webhooks during incidents).
- Smoke test with a real EGP 1 transaction.
- **Done when:** real-money smoke test completes end-to-end and rolls back cleanly via refund.

---

## 8. Test data

(Populate `docs/fawry/TEST_DATA.md` with these once you have sandbox credentials.)

- Test cards: success, decline, 3DS challenge, insufficient funds
- Test wallet numbers per provider (Vodafone, Orange, Etisalat)
- Test PAYATFAWRY flow with the sandbox dashboard's "mark as paid" button
- Captured webhook payloads for replay tests

---

## 9. Things that will bite you

- **Signature field order.** Re-read section 6 before writing any signing code.
- **Amount formatting.** Always 2 decimal places as a string (`"150.00"` not `150` or `150.0`). The signature is computed over the string form.
- **Webhook idempotency.** Fawry will retry. Use `merchantRefNumber + orderStatus` as the dedupe key.
- **Browser redirect ≠ payment success.** Only the webhook is authoritative.
- **PAYATFAWRY expiry.** Reservations can hold stock for up to 72 hours. If you don't have the cleanup cron, stock leaks.
- **Wallet payments are async.** The customer approves a push notification in their wallet app. The redirect can fire before the wallet payment finalizes — show a "waiting for confirmation" state.
- **Fees are separate.** Display order amount and any fees clearly to the customer up front. Don't surprise them at checkout.
- **Localhost can't receive webhooks.** Use ngrok during development and update the `FAWRY_WEBHOOK_URL` in the Fawry dashboard each time the ngrok URL changes. (Or pay for a stable ngrok subdomain.)
- **Two environments, two merchant codes.** Sandbox and production are entirely separate Fawry accounts. Keep the credentials separate and never mix them.

---

## 10. References

- Fawry developer portal (sandbox): `https://developer.fawrystaging.com`
- Express Checkout (Checkout Button): `https://developer.fawrystaging.com/docs/express-checkout/self-hosted-checkout`
- Server APIs overview: `https://developer.fawrystaging.com/docs/server-apis/server-apis-overview`
- Wallet payment APIs: `https://developer.fawrystaging.com/docs/server-apis/mobile-wallet-payment`
- Pay-at-Fawry reference: `https://developer.fawrystaging.com/docs/server-apis/create-payment-refno-apis`
- Sandbox base URL: `https://atfawry.fawrystaging.com`
- Production base URL: `https://www.atfawry.com`

When in doubt, the live docs win over this file. Update this file when the docs change.
