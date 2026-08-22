import Link from "next/link";

import { MenuIcon } from "@/components/icons";
import { ChevronDownIcon } from "./ChevronDownIcon";
import { NavItemLink } from "./NavItemLink";
import { closeAllDetailsInNav, closeSiblingDetails } from "./navDetails";
import { navbarStyles } from "./styles";
import type { NavbarItem } from "./types";

export function SidebarNavItems({
  items,
  onNavigate,
  parentKey = "sidebar",
}: {
  items: NavbarItem[];
  onNavigate?: () => void;
  parentKey?: string;
}) {
  return (
    <>
      {items.map((item, index) => {
        const itemKey = `${parentKey}-${index}-${item.href ?? item.label}`;

        if (item.children?.length) {
          return (
            <details key={itemKey} className={navbarStyles.navGroup}>
              <summary className={navbarStyles.navGroupSummary} onClick={closeSiblingDetails}>
                <span className="flex items-center gap-2">
                  {item.icon ? <MenuIcon name={item.icon} className="size-5 opacity-80" /> : null}
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeAllDetailsInNav(event);
                        onNavigate?.();
                      }}
                      className="transition hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </span>
                <ChevronDownIcon className={navbarStyles.navGroupChevron} />
              </summary>
              <div className={navbarStyles.subnav}>
                <SidebarNavItems items={item.children} onNavigate={onNavigate} parentKey={itemKey} />
              </div>
            </details>
          );
        }

        return (
          <NavItemLink
            key={itemKey}
            item={item}
            onClick={(event) => {
              closeAllDetailsInNav(event);
              onNavigate?.();
            }}
            className={navbarStyles.navLink}
            iconClassName="size-5 opacity-80"
          />
        );
      })}
    </>
  );
}
