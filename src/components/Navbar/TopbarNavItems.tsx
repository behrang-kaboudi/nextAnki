import Link from "next/link";

import { ChevronDownIcon } from "./ChevronDownIcon";
import { DropdownNavItems } from "./DropdownNavItems";
import { NavItemLink } from "./NavItemLink";
import { closeAllDetailsInNav, closeSiblingDetails } from "./navDetails";
import { navbarStyles } from "./styles";
import type { NavbarItem } from "./types";

export function TopbarNavItems({
  items,
  parentKey = "topbar",
}: {
  items: NavbarItem[];
  parentKey?: string;
}) {
  return (
    <>
      {items.map((item, index) => {
        const itemKey = `${parentKey}-${index}-${item.href ?? item.label}`;

        if (item.children?.length) {
          return (
            <details key={itemKey} className={navbarStyles.topbarGroup}>
              <summary className={navbarStyles.topbarGroupSummary} onClick={closeSiblingDetails}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeAllDetailsInNav(event);
                    }}
                    className="transition hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span>{item.label}</span>
                )}
                <ChevronDownIcon className={navbarStyles.topbarChevron} />
              </summary>
              <div className={navbarStyles.topbarDropdown}>
                <DropdownNavItems items={item.children} parentKey={itemKey} />
              </div>
            </details>
          );
        }

        return (
          <NavItemLink
            key={itemKey}
            item={item}
            onClick={closeAllDetailsInNav}
            className={navbarStyles.topbarLink}
            iconClassName="hidden"
          />
        );
      })}
    </>
  );
}
