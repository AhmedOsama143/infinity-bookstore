interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function PageShell({ title, subtitle, actions, children }: Props) {
  return (
    <>
      <div className="bg-page-header text-white px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{title}</h1>
            {subtitle && <p className="opacity-90 text-sm mt-1">{subtitle}</p>}
          </div>
          {actions}
        </div>
      </div>
      <div className="px-8 py-8 bg-bg-light min-h-[calc(100vh-128px)]">{children}</div>
    </>
  );
}
