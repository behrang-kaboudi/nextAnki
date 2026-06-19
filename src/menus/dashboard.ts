import type { Menu } from "./types";
import { readEditableMenus } from "@/lib/menus/menuRepository";

export const dashboardMenu: Menu = {
  id: "dashboard",
  primary: [
    { type: "link", href: "/admin/data", label: "Data", icon: "admin" },
    { type: "link", href: "/admin/db-compare", label: "Database Compare", icon: "admin" },
  ],
};

export async function getDashboardMenu(): Promise<Menu> {
  return (await readEditableMenus()).dashboard;
}
