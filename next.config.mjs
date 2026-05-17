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
};

export default nextConfig;
