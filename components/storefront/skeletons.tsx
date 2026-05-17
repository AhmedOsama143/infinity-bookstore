// Shared skeleton building blocks for loading.tsx files. Sized to mirror the
// real card/grid dimensions so the page doesn't reflow when content lands.

export function BookCardSkeleton() {
  return (
    <div className="card overflow-hidden flex flex-col h-full">
      <div className="w-full aspect-[3/4] bg-bg-light animate-pulse" />
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="h-4 w-16 bg-bg-light rounded-pill animate-pulse" />
        <div className="h-4 w-full bg-bg-light rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-bg-light rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-bg-light rounded animate-pulse mt-1" />
        <div className="mt-auto h-6 w-20 bg-bg-light rounded animate-pulse" />
      </div>
      <div className="p-3 sm:p-4 pt-0 flex gap-2">
        <div className="flex-1 h-8 bg-bg-light rounded-pill animate-pulse" />
        <div className="flex-1 h-8 bg-bg-light rounded-pill animate-pulse" />
      </div>
    </div>
  );
}

export function BookGridSkeleton({
  count = 8,
  className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TeacherCardSkeleton() {
  return (
    <div className="card p-6 flex flex-col items-center gap-3">
      <div className="w-24 h-24 rounded-full bg-bg-light animate-pulse" />
      <div className="h-4 w-32 bg-bg-light rounded animate-pulse" />
      <div className="h-3 w-20 bg-bg-light rounded animate-pulse" />
    </div>
  );
}

export function TeacherGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <TeacherCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="h-8 w-56 max-w-full bg-bg-light rounded animate-pulse mb-6" />
  );
}
