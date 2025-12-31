type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="grid gap-2">
      <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
