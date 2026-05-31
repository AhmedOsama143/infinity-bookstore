/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // AVIF first, then WebP. Next.js picks whichever the browser supports.
    // Real-world impact on book covers: 60-80% smaller payload than JPEG.
    formats: ['image/avif', 'image/webp'],
    // Cache transformed variants for a day. Covers rarely change.
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: 'bdljzgvjrkfusqtozipa.supabase.co' },
      { protocol: 'https', hostname: 'alzarifstores.com' },
    ],
  },
  // Security hardening headers applied to every response. These are the
  // CSP-independent set that cannot break rendering. A Content-Security-Policy
  // is intentionally NOT set here yet: it needs per-request nonces for GTM's
  // inline bootstrap plus an allow-list for Supabase / Font Awesome / the Fawry
  // plugin, and must be validated in a browser before enforcing — see
  // RELEASE_AUDIT.md S-35. Until then these five headers are the safe baseline.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Force HTTPS for two years incl. subdomains; eligible for preload.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Clickjacking protection — the app never frames itself cross-origin.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Stop MIME sniffing (e.g. CSV/JSON responses being treated as HTML).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't leak full URLs (which can carry query params) to other origins.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Lock down powerful features the storefront/dashboard never use.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
