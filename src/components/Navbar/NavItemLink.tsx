import Link from "next/link";

import { MenuIcon } from "@/components/icons";
import type { NavbarItem } from "./types";

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export function NavItemLink({
  item,
  className,
  iconClassName,
  onClick,
}: {
  item: NavbarItem;
  className: string;
  iconClassName: string;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const href = item.href ?? "#";
  const content = (
    <span className="flex items-center gap-2">
      {item.icon ? <MenuIcon name={item.icon} className={iconClassName} /> : null}
      <span>{item.label}</span>
    </span>
  );

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        title={item.description ?? item.label}
        onClick={onClick}
        className={className}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      title={item.description ?? item.label}
      onClick={onClick}
      className={className}
    >
      {content}
    </Link>
  );
}
