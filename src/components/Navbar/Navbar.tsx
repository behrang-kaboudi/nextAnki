import { NavbarClient } from "./Navbar.client";
import type { NavbarItem } from "./NavbarView";
import type { ThemeLayout } from "@/lib/theme/defaultThemes";
import type { MenuItem } from "@/menus";

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
  layout,
  items,
}: {
  layout: ThemeLayout;
  items: MenuItem[];
}) {
  return <NavbarClient navItems={toNavbarItems(items)} layout={layout} />;
}
