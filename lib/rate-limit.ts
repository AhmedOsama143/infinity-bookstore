/**
 * Upstash-backed sliding-window rate limiter for public endpoints.
 *
 * Why Upstash and not in-memory: Vercel functions are stateless and span
 * multiple regions. An in-memory limiter would let attackers multiply
 * effective throughput by however many region/instance combinations exist.
 *
 * Required env (production only — dev mode allows everything through):
 *   UPSTASH_REDIS_REST_URL     - copy from Upstash console
 *   UPSTASH_REDIS_REST_TOKEN   - copy from Upstash console (use the read+write token)
 *
 * Without those env vars set, `checkRateLimit` always returns allowed=true
 * and logs a warning. This means a misconfigured deploy fails open rather
 * than locking everyone out — pair with a startup-check / health-endpoint
 * later if that trade-off needs flipping.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { log } from './log';

let cachedLimiters: Map<string, Ratelimit> | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function getLimiter(name: string, requests: number, windowSec: number): Ratelimit | null {
  if (!cachedLimiters) cachedLimiters = new Map();
  const key = `${name}:${requests}:${windowSec}`;
  const existing = cachedLimiters.get(key);
  if (existing) return existing;

  const redis = getRedis();
  if (!redis) return null;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSec} s`),
    analytics: true,
    prefix: `ratelimit:${name}`,
  });
  cachedLimiters.set(key, limiter);
  return limiter;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check a request against a named rate limit. Pass the identifier you want
 * to bucket by — typically the requester's IP (`x-forwarded-for`).
 *
 * `name` is the limiter name (e.g. 'fawry-webhook'). `requests` and
 * `windowSec` are the budget. Multiple call sites can share a name to
 * share a bucket, or use distinct names for independent quotas.
 *
 * Fails open: if Upstash isn't configured or the call errors, we log and
 * allow through. We'd rather drop the rate limit than drop legitimate
 * Fawry webhooks.
 */
export async function checkRateLimit(
  name: string,
  identifier: string,
  requests: number,
  windowSec: number
): Promise<RateLimitResult> {
  const limiter = getLimiter(name, requests, windowSec);
  if (!limiter) {
    log.warn('rate-limit', 'not_configured', { name });
    return { allowed: true, limit: requests, remaining: requests, resetAt: Date.now() };
  }

  try {
    const res = await limiter.limit(identifier);
    return {
      allowed: res.success,
      limit: res.limit,
      remaining: res.remaining,
      resetAt: res.reset,
    };
  } catch (err) {
    log.error('rate-limit', 'redis_error', {
      name,
      message: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true, limit: requests, remaining: requests, resetAt: Date.now() };
  }
}

/** Best-effort client-IP extraction. Vercel sets x-forwarded-for. */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
