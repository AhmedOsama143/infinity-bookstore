# Infinity Bookstore — Project Implementation Plan
# خطة تنفيذ مشروع مكتبة إنفينيتي

> **Project root:** `D:\ammar sheta\maktabty`
> **Store brand:** مكتبة إنفينيتي | Infinity
> **UI source:** `mockup1/` (approved design — green `#578e7e` + accent `#e3af64`, Cairo/Tajawal fonts, RTL Arabic)
> **Backend:** Supabase — project `bdljzgvjrkfusqtozipa` ([dashboard](https://supabase.com/dashboard/project/bdljzgvjrkfusqtozipa))
> **Data sources:**
> - `teachers.md` — 22 teachers (to replace all teacher mock data)
> - `books.md` — 47 books (to replace all book mock data)

---

## 1. System Overview

Two separate web applications sharing one Supabase backend:

| App | Users | Purpose |
|---|---|---|
| **Storefront (Public site)** | Students / parents | Browse teachers & books, order, pick branch for pickup or delivery |
| **Admin Dashboard** | Owner (full admin) + optional branch managers (read-only per branch) | Manage inventory, orders, books, teachers, shipping, revenue |

Storefront is the already-designed `mockup1` (do not redesign — just wire it up). Admin Dashboard is a new interface built to match `mockup1`'s visual language — see §4.0 for the full dashboard design system.

---

## 2. Branches (المطلوب عرضها على الموقع)

**3 physical branches** — all visible publicly on footer, `/delivery`, and checkout. Every book stock record and every order is tied to a branch.

**Support (customer service) number:** `01104605272` — also WhatsApp-enabled. Shown in header, footer, contact page, order confirmation emails, and used as the fallback target for the floating WhatsApp FAB.

**All branch phones below are WhatsApp-enabled** — the "Order via WhatsApp" button on each branch card / book-details page deep-links to that branch's number using `https://wa.me/<number>` (international format, no `+` or spaces).

| # | Slug | Name (AR) | City | Address (AR) | Phone / WhatsApp | Coordinates |
|---|---|---|---|---|---|---|
| 1 | `tamlik` | فرع التمليك | كفر الدوار | البحيرة — كفر الدوار — التمليك — أمام مسجد الهدي | +20 120 3417049 | 31.1489677, 30.1269855 |
| 2 | `elgeish` | فرع شارع الجيش | كفر الدوار | البحيرة — كفر الدوار — شارع الجيش — خلف بنك مصر، أمام مول الأصدقاء | +20 155 8656542 | 31.1324539, 30.1351109 |
| 3 | `escott` | فرع سيدي بشر | الإسكندرية | الإسكندرية — سيدي بشر بحري — شارع 17 — فوق النفق (منطقة سيدي بشر) | +20 155 3950043 | 31.2599754, 29.9891243 |

**Google Maps pins** (open directly in Maps):
- Tamlik: https://maps.google.com/?q=31.1489677,30.1269855
- El-Geish: https://maps.google.com/?q=31.1324539,30.1351109
- Sidi Bishr (slug `escott`): https://maps.google.com/?q=31.2599754,29.9891243

**WhatsApp click-to-chat links** (deep-link into an already-prefilled chat):
- Support (general): https://wa.me/201104605272
- Tamlik: https://wa.me/201203417049
- El-Geish: https://wa.me/201558656542
- Sidi Bishr (slug `escott`): https://wa.me/201553950043

*Branch count is locked at 3 — Moharram Bey branch from early-conversation is not going to launch, so removing it entirely from the plan.*

---

## 3. Storefront — Pages & Features

All pages already exist in `mockup1/`. Each gets wired to Supabase and enhanced with branch-awareness.

| Page | Existing file | Dynamic behavior to add |
|---|---|---|
| Home | `index.html` | Hot books, featured teachers, 4-branch preview, free-shipping banner |
| Books list | `books.html` | Filter by grade, teacher, branch availability, price, search |
| Book details | `book-details.html` | Per-branch stock badge, add-to-cart with branch selector, **related books** (same teacher / same grade), **"Notify me when back in stock"** if out of stock |
| Teachers list | `teachers.html` | Real 22 teachers from `teachers.md` |
| Teacher profile | `teacher-profile.html` | Teacher bio + all books by that teacher |
| Grade level | `grade-level.html` | Books grouped by grade (الأول / الثاني / الثالث الثانوي) |
| Search | `search.html` | Search books + teachers (Postgres trigram + Arabic-aware) |
| Cart | `cart.html` | 10-book cap, branch pickup selector, shipping calculator, free-shipping progress bar |
| Wishlist | `wishlist.html` | Saved per logged-in user |
| Delivery info | `delivery.html` | Shipping rates + branch map + free-shipping offer |
| Login / Register | `login.html`, `register.html` | Email/password + Google + Facebook OAuth (no OTP) |
| Student account | (new page set) | Profile, order history, saved addresses, notifications inbox, current book count (out of 10) |
| About / FAQ | `about.html`, `faq.html` | Static, edited in admin |
| Legal | (new pages) | Privacy, Terms, Refund, Shipping policies — Arabic |

> **Stationery pages (`stationery.html`, `stationery-details.html`) are cut from v1 scope.** Can be revived in a later phase if needed.

### 3.1 Storefront business rules

1. **Account required** — no guest checkout. Students register via email/password, Google, or Facebook. No OTP.
2. **Grade-level personalization** — on first login, student picks grade (الأول / الثاني / الثالث الثانوي). All browsing defaults to their grade; changeable anytime in profile.
3. **10-book cap per student** — cumulative *delivered + pending + confirmed* across account history. Enforced client-side (disable add-to-cart + modal) and DB-level (trigger). Admin can override per-student from dashboard.
4. **Stock reservation model** — when student places an order (status = `pending`), stock is **soft-reserved** in that branch. If the order isn't confirmed by admin within **24 hours**, the reservation auto-releases via a scheduled Edge Function and stock is restored. Prevents overselling without locking inventory for abandoned COD orders.
5. **Branch selection at checkout**:
   - Pickup: student picks from the 4 branches; only branches with full-cart stock are selectable.
   - Delivery: branch auto-selected as the one that can fulfill the whole cart.
6. **Shipping rates** (editable in admin):
   - Inside Alexandria: **60 EGP**
   - Alexandria outskirts: **80 EGP**
   - Kafr El-Dawwar: **30 EGP**
   - Other governorates: **TBD** (fill later)
   - Pickup from branch: **0 EGP**
   - **🚚 Free shipping for any order ≥ 2,500 EGP** (all governorates). Threshold editable / toggle-able in admin.
7. **Order cancellation** — student may cancel within 1 hour of placing if status is still `pending`. Admin may cancel/edit any order at any time. On cancel: stock auto-restored, notification fired, audit log entry written.
8. **Stock visibility** — each book card shows "متوفر في X فرع"; details page lists exact branches and qty-per-branch availability tier (متوفر / كمية محدودة / نفد).

### 3.2 Free-shipping promotion — site-wide placement (drive AOV toward 2,500)

- **Top announcement bar** — thin strip above every header: *"🚚 شحن مجاني لكل طلب أكثر من ٢٥٠٠ جنيه!"* Dismissible (cookie).
- **Hero badge** on `index.html`.
- **Home promo card** between teachers section and testimonials, with CTA.
- **Book details page** — green info strip under the price.
- **Cart page — dynamic progress bar**: *"أضف ٧٥٠ جنيه لتحصل على شحن مجاني!"* → fills live → confetti at threshold.
- **Checkout page** — shipping line shows strike-through fee with "مجاني" in green when threshold met.
- **Footer** — small restated text.
- **Delivery page** — highlighted section near top with example cart.
- **Empty cart state** — hint text.
- **Post-login toast** — one-time per session reminder.

### 3.3 Student-side notifications

- In-site notifications inbox (bell in header, same pattern as admin but student-scoped)
- Email notifications for: order confirmed, order ready for pickup, order out for delivery, back-in-stock alerts, abandoned cart
- WhatsApp notifications (Phase 7 extra)

### 3.4 Extras visible to students

- **Related books** on book details: same teacher + same grade/subject
- **"Notify me when back in stock"** button on out-of-stock books (per branch) — emails student when `branch_stock.quantity` goes 0 → >0
- **Abandoned cart recovery** — email at 4h and 24h if student left items in cart without checking out
- **Floating WhatsApp order button** — anchored bottom-left, opens WhatsApp chat with the closest branch; mandatory in the Egyptian market as a fallback channel
- **Contact / support form** on footer

---

## 4. Admin Dashboard — Features

Full admin account owned by you. **Branch-manager accounts** (read-only, scoped to one branch — mark-picked-up permission only) can be added for branch staff so they aren't calling you for every order.

### 4.0 Dashboard UI — must match `mockup1` visual language

The admin dashboard feels like a natural sibling of the storefront — not a generic admin template. Identical design tokens, fonts, radii, shadows, and button shapes.

**Carry over from `mockup1` — identical:**
- **Colors:** `--primary:#578e7e`, `--primary-dark:#3c655a`, `--primary-light:#dcebe5`, `--accent:#e3af64`, `--accent-dark:#da9035`, `--text:#161618`, `--bg-light:#f2f2f7`, `--bg-white:#f9f9fb`
- **Fonts:** Cairo (headings/logo/buttons) + Tajawal (body/nav)
- **Direction:** RTL Arabic first
- **Radii:** `--radius:12px`, `--radius-sm:8px`
- **Shadows:** `--shadow:0 2px 12px rgba(0,0,0,0.08)`, `--shadow-lg:0 8px 32px rgba(0,0,0,0.12)`
- **Buttons:** pill (`border-radius:50px`) — primary filled accent gold, outline primary green
- **Icons:** Font Awesome 6.5.0
- **Logo:** "مكتبة إنفينيتي | Infinity" lockup in sidebar header
- **Cards:** white bg, same shadow/radius, hover lift `translateY(-6px)`
- **Hero page-headers:** green gradient banner (from `.page-header` in cart/login pages) at top of each admin page

**Dashboard-specific (within the same system):**
- **Layout:** RTL sidebar on the **right**, 240px wide, collapsible to 64px icons. Main content left. 64px top bar with breadcrumbs + notification bell + admin avatar.
- **Sidebar:** white bg, `--primary-light` borders, active item gets `--primary-light` bg + `--primary-dark` text + 3px accent-gold right-indicator.
- **Data tables:** white card container (same shadow/radius). Header row `--primary-light` bg. Row hover `--bg-light`. Subtle zebra striping.
- **Status pills:** pending → `--primary-light` + `--primary-dark`; confirmed → accent gold + white; ready/completed → `#10b981` + white; cancelled → `#e74c3c` + white.
- **KPI tiles:** white card, large Cairo number in `--primary-dark`, small Tajawal label `#666`, optional accent-gold trend arrow.
- **Charts:** Recharts themed with `--primary`, `--accent`, `--primary-dark`.
- **Forms:** 8px radius inputs, `#ddd` border, focus ring `--primary`. Labels Tajawal. Save button accent-gold pill.
- **Notification bell:** gold accent badge for unread count.
- **Empty states:** Font Awesome outline in `--primary`, reassuring Tajawal copy.
- **Mobile:** same `mobile-menu` slide-in pattern.

**NOT carried over:**
- No gradient on every page (only page-headers)
- Tighter data-dense spacing
- No "Add to Cart" CTAs — "Save", "Export", "Filter" instead (same shape/colors)

**Implementation:** `styles/tokens.css` (or Tailwind config with CSS variables) shared between storefront and admin. One brand change updates both apps.

### 4.1 Overview (home)
- Total revenue (all branches)
- Orders today / this week / this month
- Top-selling books (30 days)
- Low-stock alerts (qty ≤ 3 in any branch)
- Revenue chart by branch (pie/bar)
- **🔔 Live notification bell** (top-right of every admin page) — see §4.2

### 4.2 Real-time notifications
Persistent bell in admin header with unread counter. Fires via Supabase Realtime; chime + badge animation. Dropdown shows latest 20; full `/admin/notifications` page has paginated history with filters.

**Trigger events:**
| Event | Trigger | Payload |
|---|---|---|
| New order placed | `orders` row INSERT | #, student, branch, total, method |
| Order reserved (pending pickup) | status → `confirmed` | #, branch, items count |
| Book picked up from branch | status → `completed` (pickup) | #, branch, student, time |
| Book paid | `payment_status` → `paid` | #, method |
| COD collected | status → `completed` + COD | #, amount, branch |
| Low-stock warning | `branch_stock.quantity` ≤ 3 | book, branch, qty |
| 10-book cap hit | student tries 11th | student, phone |
| New student registered | `students` INSERT | name, phone |
| Return request | `returns` row INSERT | #, reason |
| Order cancelled | status → `cancelled` | #, by whom, reason |

**Channels (admin toggles in Settings):**
1. In-dashboard bell + chime (default on)
2. Browser Web Push (background tab)
3. Email digest (daily summary)
4. WhatsApp / Telegram bot (Phase 7)

### 4.3 Orders analytics page (`/admin/analytics/orders`)
Separate from Overview. Deep operational visibility into exact per-branch counts over time.

- **Controls:** date-range preset (Today / Yesterday / Week / Last Week / Month / Last Month / Custom), granularity (Daily/Weekly/Monthly), branch filter, fulfillment filter, payment filter.
- **KPI tiles:** Total orders, Revenue, AOV, Pickup vs Delivery, Paid vs Unpaid, Cancelled rate.
- **Orders-per-branch chart:** stacked bar by day/week/month.
- **Branch comparison table:** branch / orders / pickups / deliveries / reserved / completed / cancelled / revenue.
- **Time-series line chart:** one line per branch.
- **Heatmap:** day-of-week × hour-of-day volume per branch.
- **Exports:** CSV + printable PDF.
- **Drill-down:** click any cell to open filtered Orders list.

### 4.4 Reservations & Payments analytics (`/admin/analytics/payments`)

**Tab A — Reservations (الحجوزات)**
- Books reserved (orders `pending`/`confirmed` awaiting pickup)
- Breakdown: reserved & paid (prepaid) vs reserved & unpaid (pay-on-pickup)
- Per branch table
- Aging report (>3 days → nudge student)
- Actions: mark picked-up, cancel, extend hold

**Tab B — Payments (الدفعات)**

**Section B1 — الدفع عند الاستلام / الدفع عند التسليم (Cash)**
- COD order count + total cash
- Collected vs uncollected
- Per-branch cash totals (each register separate)
- Daily closing helper: "Branch X collected 3,450 EGP today across 12 orders"
- Historical COD table with date range

**Section B2 — الدفع الإلكتروني (Online)**
Per method (once Phase 8 ships):
- Visa / Mastercard
- Meeza
- Mobile wallets (Vodafone Cash / InstaPay / Etisalat / Orange)
- Fawry
- Bank transfer

Per method: count, amount, success rate, refunds, gateway fees, net received. Pie of method preference.

> Until Phase 8: Section B2 shows "No online payments configured yet." Section B1 works day one.

**Cross-section summary table:** COD / Cards / Wallets / Fawry / Total with Count/Amount/%.

### 4.5 Branches section
- Card per branch: orders count, pending, revenue this month, inventory value
- Click → branch detail: inventory, orders list, revenue, staff notes

### 4.6 Orders
- Orders table: #, student, phone, branch, pickup/delivery, status, total, date
- Filter: branch, status, date range, payment method
- Per-order detail: items, address, shipping fee, payment status, status-transition timeline
- Actions: confirm, mark ready, mark completed, cancel, issue refund, print invoice

### 4.7 Books
- List + filters (grade / teacher / branch / stock status)
- **Add book form:** title, teacher, description, cover upload, price, discount, final price, grade, type, weight, year, ISBN, per-branch stock (4 qty inputs)
- Bulk CSV import (for initial 47 books)
- Edit / deactivate
- **Book cover strategy:** launch with auto-generated SVG covers (title AR + teacher name on brand-gradient background). Upload real photos through admin as available — no launch blocker.

### 4.8 Teachers
- 22 teachers imported from `teachers.md`
- CRUD: name, governorate, subject, description, photo, Facebook, YouTube, website
- Link books to teachers

### 4.9 Students (customers)
- Table: name, phone, email, # books ordered (of 10), total spent, grade
- Detail: order history, 10-cap flag, override control

### 4.10 Shipping settings
- Editable rate table (governorate → price)
- **Free-shipping threshold** — default 2,500 EGP, editable, toggleable. Read from `site_settings` — promotion copy updates site-wide automatically.

### 4.11 Returns & refunds
- List of return requests
- Per-return: order, reason, items, status (requested / approved / received / refunded / rejected)
- On approve: inventory restored automatically, refund issued (manual for now, automated when payment gateway is live)

### 4.12 Reports
- CSV + PDF exports (orders, inventory, revenue per branch)
- Date-range revenue report per branch

### 4.13 Content editor
- About, FAQ entries, homepage banners, delivery info, legal pages — all stored in Supabase, rendered dynamically

### 4.14 Settings
- Business details
- Site settings: free-shipping threshold, announcement bar text + toggle, book cap
- Shipping rates editor
- Notification channel toggles
- Branch manager invites
- Admin 2FA setup (TOTP — required)

### 4.15 Audit log
- Who changed what and when (single-admin accountability + catching mistakes)

### 4.16 Later-phase extras
- Stock transfer between branches (with history)
- Printable invoice PDF with pickup QR
- Promo codes
- Reviews & ratings (moderated)
- Branch daily closing summary
- Book bundles (teacher combos) — schema present v1, UI Phase 7

---

## 5. Database Schema (Supabase / Postgres)

```
branches
  id, slug, name_ar, city, area, address_ar, phone,
  latitude, longitude, whatsapp, is_active, sort_order, created_at

teachers
  id, name_ar, governorate, subject, description,
  photo_url, facebook_url, youtube_url, website_url, is_active

books
  id, title_ar, teacher_id (FK), grade_level,
  book_type, description, cover_url, price, discount_pct, final_price,
  weight_grams, publish_year, isbn, is_active, created_at

branch_stock
  id, branch_id (FK), book_id (FK), quantity,
  reserved_quantity,              -- for soft-reserve
  updated_at
  UNIQUE(branch_id, book_id)

students
  id (= auth.users.id), full_name, phone, email,
  grade_level, governorate, address,
  books_ordered_count, cap_override,
  auth_provider ('email' | 'google' | 'facebook'),
  created_at

admin_users
  id (= auth.users.id), role ('admin' | 'branch_manager'),
  branch_id (nullable, required for branch_manager),
  mfa_enabled, created_at

orders
  id, order_number (INF-2026-0001),
  student_id (FK), branch_id (FK),
  fulfillment_type ('pickup' | 'delivery'),
  status ('pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled'),
  shipping_governorate, shipping_address, shipping_fee,
  subtotal, total, payment_status, payment_method,
  reservation_expires_at,          -- 24h soft-reserve
  cancelled_at, cancelled_by, cancel_reason,
  notes, created_at, updated_at

order_items
  id, order_id (FK), book_id (FK), quantity, unit_price, subtotal

payments
  id, order_id (FK), method ('cod' | 'card' | 'wallet' | 'fawry' | 'instapay' | 'bank_transfer'),
  provider ('paymob' | 'fawry' | 'stripe' | 'manual' | null),
  amount, currency, status ('pending' | 'paid' | 'failed' | 'refunded'),
  transaction_ref, gateway_fee, net_amount, paid_at, created_at

returns
  id, order_id (FK), items (jsonb), reason, status, refund_amount,
  requested_at, resolved_at

notifications
  id, audience ('admin' | 'branch_manager' | 'student'),
  recipient_id (nullable for broadcast),
  type, title_ar, body_ar,
  entity_type, entity_id, branch_id (nullable),
  is_read, created_at

student_notifications_inbox
  id, student_id, type, title_ar, body_ar, entity_id,
  is_read, created_at

back_in_stock_watchers
  id, student_id, book_id, branch_id (nullable = any branch),
  notified_at, created_at

abandoned_carts
  id, student_id, items (jsonb), last_activity_at,
  email_4h_sent, email_24h_sent

wishlists
  id, student_id, book_id, created_at

shipping_rates
  id, governorate_ar, area_type, price, is_active

book_bundles                     -- schema-only v1
  id, title_ar, description, price, discount_pct, final_price, is_active

bundle_items
  id, bundle_id (FK), book_id (FK), quantity

promo_codes                      -- Phase 7
  code, discount_type, discount_value, valid_from, valid_to, usage_limit

audit_log
  id, actor_id, actor_role, action, entity_type, entity_id,
  diff (jsonb), created_at

site_content
  key, title_ar, body_ar, updated_at

site_settings                    -- singleton
  id, free_shipping_threshold (2500),
  free_shipping_enabled (true),
  announcement_bar_text_ar, announcement_bar_enabled,
  student_book_cap (10),
  abandoned_cart_enabled, reservation_hold_hours (24),
  support_phone ('01104605272'),    -- customer service line
  support_whatsapp ('01104605272'),
  updated_at
```

### Supabase features to leverage
- **Auth:** email/password + Google + Facebook OAuth. Admin seeded via SQL with `role='admin'`. **Admin MFA (TOTP) required.**
- **RLS:**
  - Students see only their own orders, wishlist, notifications, profile
  - Branch managers see only orders/stock for their `branch_id`
  - Admin bypasses via `role='admin'`
  - Public reads: `books`, `teachers`, `branches`, `branch_stock`, `site_content`, `site_settings`
- **Storage buckets:** `book-covers/`, `teacher-photos/`, `banners/`
- **Edge Functions:**
  - Order confirmation email
  - Reservation auto-release (cron, runs every 5 min)
  - Abandoned cart emails (4h + 24h)
  - Back-in-stock notifier (fires on stock INSERT/UPDATE)
  - Low-stock daily digest
  - Invoice PDF generator
  - WhatsApp notification (Phase 7)
- **DB triggers:** soft-reserve stock on order `pending`; restore on cancel/expire; increment `students.books_ordered_count`; enforce 10-cap; write to `audit_log` on any entity change.
- **Realtime:** admin orders list + notifications bell.
- **Scheduled jobs (pg_cron):** reservation release, abandoned cart digest, low-stock digest.

---

## 6. Tech Stack

| Layer | Choice |
|---|---|
| Storefront | **Next.js 15 (App Router) + TypeScript** — SEO, SSR for book/teacher pages |
| Admin Dashboard | **Next.js** in same repo, route group `app/(admin)/…` |
| Styling | **Tailwind CSS** with `mockup1`'s tokens as CSS variables in `tailwind.config.ts`. Port `mockup1` markup 1:1 by replacing inline styles with Tailwind classes — identical visual output, better maintainability |
| Auth | **Supabase Auth** (email/pw + Google + Facebook). MFA required for admin. |
| DB | Supabase Postgres |
| File storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Hosting | **Vercel** (Next.js-native, preview per PR) |
| Error tracking | **Sentry** (free tier) |
| Analytics | **Plausible** (no cookie banner needed, GDPR-friendly) + **Meta Pixel** (teachers market heavily on Facebook — for retargeting) |
| Bot protection | **Cloudflare Turnstile** on register/login (free) |
| i18n | Keep `lang-toggle.js` pattern — AR default, EN toggle |
| Testing | **Vitest** unit tests (cart math, shipping calc, 10-book cap, stock reservation) + **Playwright** E2E (full checkout flow) |
| Shipping carrier | **Bosta** API (Phase 7 for delivery orders) |

**Environments:**
- **Production:** Supabase project `bdljzgvjrkfusqtozipa` + Vercel production
- **Development:** new free-tier Supabase project (I'll create in Phase 0) + Vercel preview URLs
- **Local:** Supabase CLI for local DB, `.env.local` for secrets

---

## 7. Phased Implementation Plan

> Payment is intentionally **last** (Phase 8). Until then, all orders flow as **Cash on Pickup / Cash on Delivery**.

### Phase 0 — Setup & Foundations  *(1–2 days)*  ✅ **DONE 2026-04-21**
- Init Next.js + TypeScript + Tailwind repo
- Create second Supabase project for dev
- Port `mockup1` HTML to Next.js components, swapping inline styles for Tailwind (tokens match exactly)
- Folder structure: `app/(storefront)/…`, `app/(admin)/…`, `app/(auth)/…`
- Sentry, Plausible, Meta Pixel, Turnstile installed + configured
- Git repo + initial commit

### Phase 1 — Database & Seed  *(2–3 days)*  ✅ **DONE 2026-04-22**
- All tables from §5 via Supabase SQL migrations
- RLS policies
- Seed scripts:
  - 4 branches
  - 22 teachers from `teachers.md` (with photos uploaded to Storage)
  - 47 books from `books.md` (clamping negative stock to 0, flagged for review)
  - `branch_stock` rows — default split across 4 branches (you edit in admin)
  - Admin user with MFA enrollment
  - Default `site_settings` row (2,500 threshold, 10-book cap, 24h reservation hold)
- **Auto-generated SVG book covers** at seed time (title + teacher on brand gradient) — replaced later via admin uploads
- DB triggers: soft-reserve, cap enforcement, audit log
- Edge Functions: reservation-release (pg_cron every 5 min)

### Phase 2 — Public Storefront (read-only)  *(4–6 days)*
- Home, Books, Book details, Teachers, Teacher profile, Grade level, Search, About, FAQ, Delivery, Legal pages — all from Supabase
- Branch-availability badges
- Free-shipping banner + announcement bar
- Floating WhatsApp FAB
- SEO: meta tags, sitemap, robots.txt, OpenGraph, structured data (Book/Person schemas)
- Lighthouse pass (perf, a11y, SEO ≥ 90)

### Phase 3 — Auth & User Area  *(2–3 days)*
- Email/password + Google + Facebook OAuth
- Turnstile on forms
- Grade selection on first login
- Student profile (edit name, phone, address, grade)
- Wishlist
- Empty order history
- Notifications inbox (bell)

### Phase 4 — Cart & Checkout (no payment)  *(4–5 days)*
- Cart with qty, branch availability, **10-book cap enforcement** (client + DB)
- **Free-shipping progress bar** (live)
- Checkout: pickup vs delivery → branch selection → address → shipping calc → review → place order (`pending`, COD)
- **Soft-reserve** kicks in on place; auto-release after 24h if not confirmed
- Order confirmation page + email (Supabase Edge Function)
- **Back-in-stock watcher** opt-in on out-of-stock books
- **Abandoned cart** emails (4h + 24h via scheduled Edge Function)
- **Related books** component on details page
- Unit tests for cart math, shipping calc, cap, reservation

### Phase 5 — Admin Dashboard Core  *(6–8 days)*
- Admin auth gate + TOTP enrollment flow
- Overview with KPIs
- Orders list + detail + status transitions
- Per-branch section (inventory, orders, revenue)
- Books CRUD with per-branch stock editor + CSV import
- Teachers CRUD
- Students list with cap override
- Shipping rates editor
- Branch manager invites + role-scoped RLS

### Phase 6 — Polish, Analytics, Notifications, Returns  *(4–5 days)*
- CSV + PDF exports
- Low-stock alerts
- Audit log page
- Content editor (About, FAQ, banners, legal pages)
- **Notification system** (bell, Realtime, chime, Web Push opt-in, daily email digest) — admin + student inboxes
- **Orders analytics page** (daily/weekly/monthly per-branch, heatmap, drill-down)
- **Reservations & Payments analytics** (Tab A + B1 live; B2 placeholder until Phase 8)
- **Returns/refunds flow** (admin UI + student-request from order history)
- Playwright E2E tests (full checkout + admin confirm flow)

### Phase 7 — Extras  *(pick-and-choose)*
- WhatsApp order notifications via API
- Printable invoice PDF with pickup QR
- Promo codes
- Reviews & ratings
- Stock transfer between branches
- **Book bundles** UI (schema already present)
- **Bosta shipping integration** for delivery orders (tracking numbers auto-generated)

### Phase 8 — Payment Integration  *(LAST — awaiting your decision)*
Egypt options:
- **Paymob** (cards + wallets + Fawry — most widely used, recommended)
- **Fawry** (cash via Fawry outlets — great for studentwithoutcards)
- **Kashier** / **MyFatoorah**
- **Stripe** (cards only, no local wallets)

Wire into checkout as a new payment step before `orders.status = pending`. Section B2 of payments analytics goes live automatically.

### Phase 9 — Launch
- Production deploy to Vercel
- Domain + SSL
- Supabase backups configured (Point-in-Time Recovery enabled on Pro tier)
- Sentry alerts to your email
- Branch-staff training walkthrough for admin dashboard
- Social soft-launch (Facebook) + retargeting audience build

---

## 8. Decisions Locked In

| Topic | Decision |
|---|---|
| Auth | Email/password + Google + Facebook (no OTP) |
| Guest checkout | Not allowed (account required — social login keeps friction low) |
| Stock reservation | Soft-reserve on `pending`, 24h auto-release |
| Book covers | Auto-generated SVG placeholders at launch; admin uploads real covers over time |
| Negative stock in `books.md` | Clamped to 0, flagged in admin for review |
| Admin 2FA | Required (TOTP via Supabase MFA) |
| Dev environment | Second free-tier Supabase project |
| Stationery section | Cut from v1 |
| CSS approach | Tailwind with `mockup1` tokens as CSS variables |
| Branch-manager role | Yes, read-only + mark-picked-up |
| Order cancellation | Student ≤1h if pending; admin anytime |
| Testing | Vitest unit + Playwright E2E |
| Analytics | Plausible + Meta Pixel (no GA4) |
| Error tracking | Sentry free tier |
| Bot protection | Cloudflare Turnstile on register/login |
| Shipping integration | Bosta (Phase 7) |
| Legal pages | Privacy, Terms, Refund, Shipping — Arabic |
| Student notifications | Email v1, WhatsApp Phase 7 |
| Back-in-stock watcher | v1 |
| Related books | v1 |
| Grade personalization | v1 (asked on first login) |
| WhatsApp fallback FAB | v1 |
| Abandoned cart recovery | v1 (4h + 24h emails) |
| Returns/refunds | Schema now, UI in Phase 6 |
| Book bundles | Schema now, UI in Phase 7 |

---

## 9. Still Need From You

Not blocking Phase 0, but needed by the end of Phase 1:

1. ~~**Branch details**~~ — ✅ fully resolved 2026-04-21. 3 branches (Tamlik, El-Geish, Escott) locked in §2 with addresses, phones (all WhatsApp-enabled), and map pins.
2. **Initial per-branch stock allocation** — or confirm you're OK with seeding an even split, then correcting in admin
3. **Shipping rates for other governorates** — full table beyond Alex / Kafr El-Dawwar
4. **Domain name** — owned already or need to register?
5. **Branding assets** — logo file, favicon (palette is already in `mockup1`)
6. ~~**Admin email**~~ — ✅ `ammar@infinty.admin` account created 2026-04-21 (user ID `fb76fb5d-8273-4403-868a-f505b79f955f`, role=admin). Credentials in `.admin-credentials.md` (gitignored).
7. ~~**Branch WhatsApp numbers**~~ — ✅ all branch phones above are WhatsApp-enabled; support line `01104605272` too. Click-to-chat links are in §2.
8. **Delivery policy** — does each branch ship to its own region only, or do all branches ship countrywide from a single hub?
9. **Return window** — how many days after pickup can a student request a return?
10. **Bilingual Y/N** — AR only, or AR + EN fully bilingual?
11. ~~**Supabase API keys**~~ — ✅ received 2026-04-21, stored in `.env.local` (gitignored). Connectivity verified.

---

## 10. Files in this Repo

| File | Purpose |
|---|---|
| `PROJECT_PLAN.md` | This document |
| `teachers.md` | Source of truth for 22 teachers (Phase 1 seed) |
| `books.md` | Source of truth for 47 books (Phase 1 seed) |
| `mockup1/` | Approved UI — becomes storefront in Phase 0 |
| `mockup4/` | Alternate mockup — will be deleted |

---

*Plan v2 — 2026-04-20. Decisions locked in §8. Update as new decisions are finalized.*
