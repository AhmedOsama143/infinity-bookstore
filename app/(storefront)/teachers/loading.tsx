import { TeacherGridSkeleton, PageHeaderSkeleton } from '@/components/storefront/skeletons';

export default function Loading() {
  return (
    <section className="section">
      <div className="container-app">
        <PageHeaderSkeleton />
        <TeacherGridSkeleton count={12} />
      </div>
    </section>
  );
}
