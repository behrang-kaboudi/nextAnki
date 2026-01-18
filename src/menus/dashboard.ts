import type { Menu } from "./types";

export const dashboardMenu: Menu = {
  id: "dashboard",
  primary: [
    { type: "link", href: "/admin/themes", label: "Themes", icon: "admin" },
    { type: "link", href: "/admin/data", label: "Data", icon: "admin" },
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
