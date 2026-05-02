export default function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-page-header text-white py-8 sm:py-10 md:py-14 text-center">
      <div className="container-app">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2">{title}</h1>
        {subtitle && <p className="text-sm sm:text-lg opacity-90">{subtitle}</p>}
      </div>
    </section>
  );
}
