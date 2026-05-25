/**
 * Sanitize a `next` redirect target so it can only point at our own site.
 *
 * Why: every place that takes a `?next=…` query param and feeds it to
 * `redirect()` / `NextResponse.redirect()` / `signInWithOAuth({ redirectTo })`
 * is a potential open redirect. `new URL(next, origin)` does NOT scope to
 * `origin` when `next` is absolute, and `redirect()` accepts absolute URLs.
 *
 * Accepts paths starting with a single `/` (e.g. `/account`, `/checkout?ok=1`).
 * Rejects: protocol-relative URLs (`//evil.com/x`), absolute URLs of any
 * scheme (`https:`, `javascript:`, `data:`), backslash variants (`/\evil`),
 * and anything that isn't a string.
 */
export function safeNextPath(path: unknown, fallback = '/'): string {
  if (typeof path !== 'string' || path.length === 0) return fallback;
  if (!path.startsWith('/')) return fallback;
  if (path.startsWith('//')) return fallback;
  if (path.startsWith('/\\')) return fallback;
  return path;
}
