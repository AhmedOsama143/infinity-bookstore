import { getSiteContent } from '@/lib/data';
import PageHeader from '@/components/storefront/page-header';

export const metadata = { title: 'من نحن | مكتبة إنفينيتي' };

export default async function AboutPage() {
  const content = await getSiteContent('about');
  return (
    <>
      <PageHeader title={content?.title_ar ?? 'من نحن'} />
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
