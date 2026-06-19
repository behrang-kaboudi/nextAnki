type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mx-auto grid max-w-5xl gap-2 text-center">
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mx-auto max-w-3xl text-base leading-7 text-muted sm:text-xl">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
