import { NavbarClient } from "./Navbar.client";
import type { NavbarItem } from "./types";
import type { MenuItem } from "@/menus/types";

function toNavbarItems(items: MenuItem[]): NavbarItem[] {
  return items.map((item) => {
    if (item.type === "group") {
      return {
        label: item.label,
        icon: item.icon,
        children: toNavbarItems(item.items),
      };
    }

    return {
      label: item.label,
      href: item.href,
      icon: item.icon,
      description: item.description,
    };
  });
}

export function Navbar({
  items,
}: {
  items: MenuItem[];
}) {
  return <NavbarClient navItems={toNavbarItems(items)} />;
}
