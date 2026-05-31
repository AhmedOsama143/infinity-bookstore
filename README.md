# Infinity Bookstore | مكتبة إنفينيتي

Online bookstore for Egyptian secondary-school students. Multi-branch
(Kafr El-Dawwar + Alexandria) with per-branch inventory, pickup or delivery,
a per-student 10-book cap, free shipping over EGP 2,500, Fawry online
payments + cash on delivery, and a separate admin dashboard.

**Stack:** Next.js 15 · React 19 · TypeScript (strict) · Tailwind 3 · Supabase
(Postgres + Auth + Storage + Realtime) · Fawry · Vercel.

See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) for the full product specification
and [`docs/fawry/INTEGRATION_PLAN.md`](./docs/fawry/INTEGRATION_PLAN.md) for
the payment integration.

---

## Quick start

Requirements:

- Node **20+**
- npm **10+**
- Access to the project's Supabase instance (project ref `bdljzgvjrkfusqtozipa`)
  and the Fawry merchant credentials.

```bash
# 1. Install
npm ci

# 2. Configure environment
cp .env.example .env.local
# fill in the Supabase + Fawry + cron values (see `.env.example` for every var)

# 3. (First-time) link the Supabase CLI to the remote project
npm run db:link

# 4. (First-time) seed the books + teachers data
npm run seed

# 5. Run the dev server
npm run dev          # http://localhost:3000
```

For Fawry webhook testing you'll also need `ngrok` pointed at
`localhost:3000` and the resulting URL pasted into the Fawry sandbox
dashboard.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Produce a production build. |
| `npm run start` | Serve the production build. |
| `npm run type-check` | `tsc --noEmit` — strict type-check. |
| `npm run lint` | ESLint over the codebase. |
| `npm test` | Run Vitest unit + integration suites. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:coverage` | Run with v8 coverage; HTML report under `coverage/`. |
| `npm run test:e2e` | Playwright E2E (boots the dev server unless `PLAYWRIGHT_BASE_URL` is set). |
| `npm run test:fawry` | Standalone signature + webhook test runner (legacy ad-hoc tsx). |
| `npm run seed` | Seed books + teachers from the markdown source files. |
| `npm run seed:fawry` | Seed a couple of Fawry test orders. |
| `npm run db:push` | Apply local migrations under `supabase/migrations/` to the linked DB. |
| `npm run db:link` | Link this checkout to the remote Supabase project. |

---

## Project layout

```
app/                           Next.js App Router
  (storefront)/                public storefront — RTL Arabic
  (auth)/                      /login, /register
  admin/                       staff dashboard (auth-gated)
  api/
    health/                    liveness + readiness probe
    cron/expire-orders/        hourly Vercel Cron
    fawry/{webhook,refund,status} server-side Fawry endpoints
    admin/export/[type]/       CSV exports (orders / inventory / students)
  auth/callback/               OAuth code-exchange handler
components/                    React components, grouped by surface
lib/
  supabase/                    server + browser + admin clients
  fawry/                       client, signing, types, reconcile, config
  cart/                        order actions, server actions, shipping
  admin/                       admin server actions (CRUD + audit)
  stock/                       holds + integrity helpers
  auth/                        actions + safe-next sanitizer
  analytics/                   GTM + server-side funnel events
  log.ts                       structured JSON logger
  rate-limit.ts                Upstash sliding-window limiter
supabase/
  migrations/                  SQL migrations (001..023)
docs/fawry/                    integration plan + signing reference
scripts/                       seed + ad-hoc test scripts
tests/                         Vitest unit + Playwright e2e
```

---

## Deployment

The repo ships with `vercel.json` configuring a single hourly cron at
`/api/cron/expire-orders`. To deploy:

1. Push the branch to GitHub.
2. Vercel auto-builds + deploys on push to `main`.
3. Set every variable from [`.env.example`](./.env.example) in Vercel's
   Project Settings → Environment Variables (Production + Preview).
4. Confirm `vercel.json`'s crons are registered (Vercel Dashboard → Cron Jobs).
5. Apply pending DB migrations from this checkout: `npm run db:push`.
6. For Fawry, set the merchant dashboard's webhook URL to
   `https://<your-domain>/api/fawry/webhook`.

A `/api/health` GET will return `{ ok, checks: { supabase }, ts }` once the
build is live — point any external uptime monitor at it.

---

## Branches & customer-facing flows

The store operates from three branches. See `PROJECT_PLAN.md` for the canonical
list, phone numbers, addresses, and WhatsApp deep-links.

---

## Documentation

- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) — full product spec + business rules.
- [`CLAUDE.md`](./CLAUDE.md) — conventions, secrets, idempotency, error handling, testing.
- [`docs/fawry/INTEGRATION_PLAN.md`](./docs/fawry/INTEGRATION_PLAN.md) — Fawry slices + DB schema.
- [`docs/fawry/SIGNING_REFERENCE.md`](./docs/fawry/SIGNING_REFERENCE.md) — signature field order per endpoint.
- [`RELEASE_AUDIT.md`](./RELEASE_AUDIT.md) — every finding + fix in the v1.0.0 audit.
- [`CHANGELOG.md`](./CHANGELOG.md) — version history.

---

## License

Proprietary — All Rights Reserved. See [`LICENSE`](./LICENSE).
