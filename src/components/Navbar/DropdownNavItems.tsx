import { MenuIcon } from "@/components/icons";
import { ChevronDownIcon } from "./ChevronDownIcon";
import { NavItemLink } from "./NavItemLink";
import { closeAllDetailsInNav } from "./navDetails";
import { navbarStyles } from "./styles";
import type { NavbarItem } from "./types";

export function DropdownNavItems({
  items,
  parentKey = "dropdown",
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
            <details key={itemKey} className={navbarStyles.dropdownGroup}>
              <summary className={navbarStyles.dropdownGroupSummary}>
                <span className="flex items-center gap-2">
                  {item.icon ? <MenuIcon name={item.icon} className="size-4 opacity-70" /> : null}
                  <span>{item.label}</span>
                </span>
                <ChevronDownIcon className={navbarStyles.navGroupChevron} />
              </summary>
              <div className={navbarStyles.dropdownSubnav}>
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
            className={navbarStyles.dropdownLink}
            iconClassName="size-4 opacity-70"
          />
        );
      })}
    </>
  );
}
