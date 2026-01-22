import type { Menu } from "./types";

export const siteMenu: Menu = {
  id: "marketing",
  primary: [
    {
      type: "link",
      href: "/features",
      label: "Home",
      icon: "home",
      description: "Main app entry (features overview)",
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
      href: "/about",
      label: "About",
      icon: "about",
      description: "Project info and notes",
    },
  ],
};
