import { BookGridSkeleton, PageHeaderSkeleton } from '@/components/storefront/skeletons';

export default function Loading() {
  return (
    <section className="section">
      <div className="container-app space-y-12">
        <div>
          <PageHeaderSkeleton />
          <BookGridSkeleton count={4} className="grid grid-cols-2 md:grid-cols-4 gap-6" />
        </div>
        <div>
          <PageHeaderSkeleton />
          <BookGridSkeleton count={4} className="grid grid-cols-2 md:grid-cols-4 gap-6" />
        </div>
        <div>
          <PageHeaderSkeleton />
          <BookGridSkeleton count={4} className="grid grid-cols-2 md:grid-cols-4 gap-6" />
        </div>
      </div>
    </section>
  );
}
