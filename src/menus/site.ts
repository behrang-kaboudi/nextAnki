import type { Menu } from "./types";
import { readEditableMenus } from "@/lib/menus/menuRepository";

export const siteMenu: Menu = {
  id: "marketing",
  primary: [
    {
      type: "link",
      href: "/",
      label: "Home",
      icon: "home",
      description: "Main app entry (features overview)",
    },
    {
      type: "link",
      href: "/guides",
      label: "Guides",
      icon: "book",
      description: "How-to guides and walkthroughs",
    },
    {
      type: "link",
      href: "/tests",
      label: "Tests",
      icon: "tools",
      description: "Hub for internal dev/test pages",
    },
    {
      type: "link",
      href: "/site-map",
      label: "Site Map",
      icon: "search",
      description: "Human-readable map of every canonical page",
    },
    {
      type: "link",
      href: "/about",
      label: "About",
      icon: "about",
      description: "Project info and notes",
    },
  ],
};

export async function getSiteMenu(): Promise<Menu> {
  return (await readEditableMenus()).site;
}
