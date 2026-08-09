import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  titleAccessory?: ReactNode;
};

export function PageHeader({ title, subtitle, titleAccessory }: PageHeaderProps) {
  return (
    <div className="mx-auto grid max-w-5xl gap-2 text-center">
      <div className="flex items-center justify-center gap-2">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        {titleAccessory}
      </div>
      {subtitle ? (
        <p className="mx-auto max-w-3xl text-base leading-7 text-muted sm:text-xl">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
