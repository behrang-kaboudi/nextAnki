import type { Menu } from "./types";

export const dashboardMenu: Menu = {
  id: "dashboard",
  primary: [
    { type: "link", href: "/admin/themes", label: "Theme Settings", icon: "admin" },
    { type: "link", href: "/admin/data", label: "Data", icon: "admin" },
    { type: "link", href: "/admin/db-compare", label: "Database Compare", icon: "admin" },
    {
      type: "group",
      label: "Word",
      icon: "anki",
      items: [
        {
          type: "link",
          href: "/admin/word/imageability",
          label: "Sentences",
          icon: "anki",
        },
      ],
    },
  ],
};
