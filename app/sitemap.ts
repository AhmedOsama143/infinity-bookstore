import type { MetadataRoute } from 'next';
import { getBooks, getTeachers } from '@/lib/data';

const BASE = 'https://infinity-bookstore.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [books, teachers] = await Promise.all([getBooks({}), getTeachers()]);

  // Note: '/search' is intentionally excluded — it is noindex (internal search
  // results), so advertising it in the sitemap would send a mixed signal.
  const staticRoutes = [
    '', '/books', '/teachers', '/grade-level', '/branches',
    '/delivery', '/about', '/faq',
    '/legal/privacy', '/legal/terms', '/legal/refund', '/legal/shipping_policy',
  ];

  return [
    ...staticRoutes.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1.0 : 0.7,
    })),
    ...books.map((b) => ({
      url: `${BASE}/books/${b.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...teachers.map((t) => ({
      url: `${BASE}/teachers/${t.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
