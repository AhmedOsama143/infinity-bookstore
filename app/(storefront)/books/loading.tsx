import { BookGridSkeleton, PageHeaderSkeleton } from '@/components/storefront/skeletons';

export default function Loading() {
  return (
    <section className="section">
      <div className="container-app">
        <PageHeaderSkeleton />
        <div className="h-12 w-full bg-bg-light rounded-card animate-pulse mb-6" />
        <BookGridSkeleton count={12} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" />
      </div>
    </section>
  );
}
