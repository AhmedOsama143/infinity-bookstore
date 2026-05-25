You are tasked with preparing this project for its initial production release (v1.0.0). Perform a comprehensive audit and remediation across all critical areas. Work systematically, document your findings, and fix issues as you go.

## Operating Principles

- **Investigate before changing.** Read the codebase, understand architecture and conventions, then act.
- **Preserve behavior unless it's a bug.** Don't refactor for taste; refactor for correctness, security, performance, or clarity.
- **Small, reviewable commits.** Group related changes. Write clear commit messages.
- **Verify every change.** Run tests, linters, and builds after each meaningful change.
- **Ask before destructive actions.** Schema migrations, dependency major bumps, or removing features require confirmation.
- **Report progress in checkpoints.** After each phase, summarize what was done, what was deferred, and why.

## Phase 1: Discovery & Baseline

1. Map the project: framework, language, package manager, build system, deployment target, environment variables, third-party services.
2. Run existing build, lint, type-check, and test commands. Record baseline pass/fail and warnings.
3. Identify the tech stack's standard tooling (e.g., ESLint, Prettier, Ruff, Black, Pytest, Vitest, Lighthouse, axe-core) and ensure it's configured.
4. Produce a `RELEASE_AUDIT.md` at the repo root tracking findings, severity (Critical/High/Medium/Low), status, and decisions.

## Phase 2: Code Quality & Bug Hunt

- Read every source file. Flag and fix:
  - Logic errors, off-by-one, incorrect conditionals, unhandled promise rejections, race conditions.
  - Null/undefined access, type coercion bugs, incorrect async/await usage.
  - Dead code, unreachable branches, unused exports, duplicated logic.
  - Improper error handling — every thrown error must be caught or intentionally propagated with context.
  - Inconsistent state management, stale closures, memory leaks (listeners, subscriptions, intervals).
- Enforce strict typing where applicable (TypeScript `strict`, Python type hints with mypy/pyright).
- Standardize formatting and linting; resolve all warnings or document why they're suppressed.
- Replace `console.log`/debug prints with a proper logger; remove commented-out code.

## Phase 3: Security

- Run dependency audit (`npm audit`, `pip-audit`, `cargo audit`, equivalent). Patch known CVEs; upgrade transitively where needed.
- Scan for: hardcoded secrets, API keys, tokens, credentials in code or git history. Move to env vars; document required vars in `.env.example`.
- Validate and sanitize ALL user input. Check for: SQL injection, XSS, CSRF, SSRF, path traversal, command injection, prototype pollution, ReDoS.
- Verify authentication and authorization on every protected route/action. Check session handling, token expiry, refresh logic.
- Confirm HTTPS-only, secure cookies (HttpOnly, Secure, SameSite), CORS allowlist, CSP, HSTS, X-Frame-Options, and other security headers.
- Rate-limit public endpoints. Add brute-force protection on auth endpoints.
- Ensure errors don't leak stack traces, internal paths, or DB info to clients in production.
- For file uploads: validate type/size, scan, store outside web root, serve through controlled endpoints.

## Phase 4: UI / UX Polish

- Audit every screen/component for visual consistency: spacing scale, typography hierarchy, color tokens, border radii, shadows, motion.
- Fix: misaligned elements, inconsistent button styles, broken hover/focus/active/disabled states, layout shift, overflow bugs.
- Responsive review: test mobile (≤480px), tablet (768px), desktop (1280px+). Fix breakpoints, touch targets (min 44×44px), and orientation issues.
- Loading states, empty states, error states — every async surface needs all three.
- Form UX: inline validation, clear error messages, proper input types, autocomplete attributes, labels associated with inputs.
- Microcopy review: clear, concise, friendly, action-oriented. Eliminate jargon and dead-end messages.
- Dark mode (if supported): verify contrast and asset variants.
- Animations: respect `prefers-reduced-motion`; keep durations under 300ms for UI feedback.

## Phase 5: Accessibility (WCAG 2.1 AA)

- Run axe-core or Lighthouse a11y audit; resolve all violations.
- Semantic HTML, proper heading order, landmark regions, skip links.
- Keyboard navigation: every interactive element reachable and operable; visible focus rings.
- ARIA only where native semantics fall short; verify roles and states.
- Color contrast ≥4.5:1 for text, ≥3:1 for UI components.
- Alt text on all meaningful images; decorative images marked appropriately.
- Screen reader smoke test on a primary flow.

## Phase 6: SEO

- Unique `<title>` and meta description per page; titles ≤60 chars, descriptions ≤155 chars.
- Open Graph + Twitter Card tags with valid image dimensions.
- Canonical URLs, proper `hreflang` if multilingual.
- `robots.txt` and dynamically generated `sitemap.xml`.
- Structured data (JSON-LD) appropriate to content type; validate with schema.org.
- Semantic URL structure, no duplicate content, proper 301s for any redirects.
- Server-side rendering or pre-rendering for indexable pages if using a JS framework.
- Image alt text, descriptive filenames, lazy loading for below-fold.

## Phase 7: Performance

- Run Lighthouse on key pages; target Performance, Accessibility, Best Practices, SEO scores ≥90.
- Core Web Vitals targets: LCP <2.5s, INP <200ms, CLS <0.1.
- Bundle analysis: code-split routes, lazy-load heavy components, tree-shake, eliminate duplicate deps.
- Images: modern formats (WebP/AVIF), responsive `srcset`, explicit width/height to prevent CLS.
- Fonts: `font-display: swap`, preload critical fonts, subset where possible.
- Caching: long-lived immutable assets, proper `Cache-Control` headers, CDN-ready.
- Database: identify N+1 queries, add indexes for common lookups, paginate large lists.
- API: enable gzip/brotli, ETag/Last-Modified, payload size review.

## Phase 8: Testing

- Establish minimum coverage: 80% lines/branches for business logic; 100% for security-critical and payment paths.
- Unit tests: pure functions, utilities, reducers, validators, formatters — happy path, edge cases, and error cases for each.
- Integration tests: API endpoints, DB interactions, auth flows, third-party service mocks.
- E2E smoke tests: signup, login, primary user journey, checkout/conversion path.
- Snapshot tests sparingly; prefer behavioral assertions.
- All tests must be deterministic — no time, network, or order dependencies. Use fixed seeds and mocked clocks.
- Wire tests into CI; block merges on failure.

## Phase 9: Observability & Operations

- Structured logging with levels; no PII in logs.
- Error tracking integration (Sentry or equivalent) configured for production only.
- Health check endpoint(s) for liveness and readiness.
- Basic metrics: request rate, error rate, latency, key business events.
- Graceful shutdown handlers for long-running processes.

## Phase 10: Release Hygiene

- `README.md`: clear setup, env vars, scripts, deployment instructions.
- `CHANGELOG.md` initialized with v1.0.0 entry.
- `LICENSE` present and correct.
- `.env.example` lists every required variable with descriptions.
- Production build succeeds from a clean clone with documented steps.
- Pre-commit hooks: lint, format, type-check, run affected tests.
- CI pipeline: install → lint → type-check → test → build → security scan.
- Version bumped to 1.0.0 in package manifest; git tag prepared (not pushed without confirmation).

## Final Deliverable

When all phases are complete, produce:

1. Updated `RELEASE_AUDIT.md` with every finding, fix, and deferred item with rationale.
2. A `RELEASE_NOTES.md` summarizing the v1.0.0 release — features, known limitations, upgrade notes.
3. A short go/no-go recommendation for production release, listing any remaining blockers.

Begin with Phase 1. Pause and report after each phase before continuing to the next.