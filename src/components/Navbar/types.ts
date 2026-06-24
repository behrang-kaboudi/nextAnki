import { MenuIcon } from "@/components/icons";

export type NavbarItem = {
  label: string;
  href?: string;
  children?: NavbarItem[];
  icon?: Parameters<typeof MenuIcon>[0]["name"];
  description?: string;
};
