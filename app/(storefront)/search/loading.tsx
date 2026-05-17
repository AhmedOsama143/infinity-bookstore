import { BookGridSkeleton, PageHeaderSkeleton } from '@/components/storefront/skeletons';

export default function Loading() {
  return (
    <section className="section">
      <div className="container-app">
        <PageHeaderSkeleton />
        <BookGridSkeleton count={8} />
      </div>
    </section>
  );
}
