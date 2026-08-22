export const menuIconNames = [
  "sparkles",
  "home",
  "app",
  "tools",
  "ipa",
  "anki",
  "admin",
  "about",
  "login",
  "account",
  "book",
  "database",
  "settings",
  "brain",
  "file",
  "code",
  "search",
  "audio",
  "image",
  "link",
] as const;

export type MenuIcon = (typeof menuIconNames)[number];

export type MenuId = "marketing" | "app" | "dashboard";

export type MenuLinkItem = {
  type: "link";
  label: string;
  href: string;
  icon?: MenuIcon;
  description?: string;
};

export type MenuGroupItem = {
  type: "group";
  label: string;
  items: MenuItem[];
  href?: string;
  icon?: MenuIcon;
};

export type MenuItem = MenuLinkItem | MenuGroupItem;

export type Menu = {
  id: MenuId;
  primary: MenuItem[];
};

export type EditableMenus = {
  site: Menu;
  dashboard: Menu;
};
