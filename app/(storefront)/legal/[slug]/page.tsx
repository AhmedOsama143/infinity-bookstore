import { notFound } from 'next/navigation';
import { getSiteContent } from '@/lib/data';
import PageHeader from '@/components/storefront/page-header';

const ALLOWED = ['privacy', 'terms', 'refund', 'shipping_policy'] as const;
type Slug = (typeof ALLOWED)[number];

interface PageProps { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  if (!ALLOWED.includes(slug as Slug)) return { title: 'صفحة غير موجودة' };
  const content = await getSiteContent(slug);
  return { title: `${content?.title_ar ?? slug} | مركز إنفينيتي` };
}

export default async function LegalPage({ params }: PageProps) {
  const { slug } = await params;
  if (!ALLOWED.includes(slug as Slug)) notFound();
  const content = await getSiteContent(slug);
  return (
    <>
      <PageHeader title={content?.title_ar ?? slug} />
      <section className="section">
        <div className="container-app max-w-3xl">
          <div className="card p-8 whitespace-pre-wrap leading-loose">
            {content?.body_ar ?? 'جاري إعداد المحتوى.'}
          </div>
        </div>
      </section>
    </>
  );
}

export function generateStaticParams() {
  return ALLOWED.map((slug) => ({ slug }));
}
