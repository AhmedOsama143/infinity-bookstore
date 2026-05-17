// PDP skeleton — mirrors the real layout: breadcrumb + 3:4 cover left of a
// stack of title / teacher / price / availability / CTA blocks.

export default function Loading() {
  return (
    <section className="section">
      <div className="container-app">
        <div className="h-4 w-40 bg-bg-light rounded animate-pulse mb-6" />
        <div className="grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-6 md:gap-10">
          <div className="aspect-[3/4] rounded-card bg-bg-light animate-pulse" />
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-bg-light rounded-pill animate-pulse" />
              <div className="h-6 w-20 bg-bg-light rounded-pill animate-pulse" />
            </div>
            <div className="h-9 w-3/4 bg-bg-light rounded animate-pulse" />
            <div className="h-5 w-32 bg-bg-light rounded animate-pulse" />
            <div className="h-10 w-40 bg-bg-light rounded animate-pulse" />
            <div className="h-24 w-full bg-bg-light rounded-card animate-pulse" />
            <div className="h-40 w-full bg-bg-light rounded-card animate-pulse" />
            <div className="h-12 w-48 bg-bg-light rounded-pill animate-pulse" />
            <div className="space-y-2 pt-4">
              <div className="h-4 w-full bg-bg-light rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-bg-light rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-bg-light rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
