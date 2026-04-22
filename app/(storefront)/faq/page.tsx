import { getSiteContent } from '@/lib/data';
import PageHeader from '@/components/storefront/page-header';

export const metadata = { title: 'الأسئلة الشائعة | مكتبة إنفينيتي' };

export default async function FaqPage() {
  const content = await getSiteContent('faq');
  return (
    <>
      <PageHeader title={content?.title_ar ?? 'الأسئلة الشائعة'} />
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
