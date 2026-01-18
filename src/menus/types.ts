import type { Route } from "next";

export type MenuIcon =
  | "sparkles"
  | "home"
  | "app"
  | "tools"
  | "ipa"
  | "anki"
  | "admin"
  | "about"
  | "login"
  | "account";

export type MenuLinkItem = {
  type: "link";
  label: string;
  href: Route<string>;
  icon?: MenuIcon;
};

export type MenuGroupItem = {
  type: "group";
  label: string;
  items: MenuItem[];
  icon?: MenuIcon;
};

export type MenuItem = MenuLinkItem | MenuGroupItem;

export type Menu = {
  id: "marketing" | "app" | "dashboard";
  primary: MenuItem[];
};
