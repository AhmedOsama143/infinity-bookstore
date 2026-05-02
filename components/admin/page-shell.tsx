interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function PageShell({ title, subtitle, actions, children }: Props) {
  return (
    <>
      <div className="bg-page-header text-white px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold">{title}</h1>
            {subtitle && <p className="opacity-90 text-xs sm:text-sm mt-1">{subtitle}</p>}
          </div>
          {actions}
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-8 bg-bg-light min-h-[calc(100vh-128px)]">{children}</div>
    </>
  );
}
