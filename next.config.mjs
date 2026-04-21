/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'bdljzgvjrkfusqtozipa.supabase.co' },
      { protocol: 'https', hostname: 'alzarifstores.com' },
    ],
  },
};

export default nextConfig;
