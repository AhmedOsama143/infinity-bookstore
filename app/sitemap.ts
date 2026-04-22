import type { MetadataRoute } from 'next';
import { getBooks, getTeachers } from '@/lib/data';

const BASE = 'https://infinity-bookstore.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [books, teachers] = await Promise.all([getBooks({}), getTeachers()]);

  const staticRoutes = [
    '', '/books', '/teachers', '/grade-level', '/branches',
    '/delivery', '/about', '/faq', '/search',
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
