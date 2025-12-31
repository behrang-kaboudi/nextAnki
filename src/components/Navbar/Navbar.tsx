import { NavbarClient } from "./Navbar.client";
import type { NavbarItem } from "./NavbarView";
import type { ThemeLayout } from "@/lib/theme/defaultThemes";

const navItems: NavbarItem[] = [
  { href: "/features", label: "Features" },
  { href: "/connect", label: "Connect" },
  { href: "/docs", label: "Docs" },
  { href: "/anki-note", label: "Anki Note" },
  { href: "/anki-deck", label: "Decks" },
  { href: "/admin/themes", label: "Admin" },
  { href: "/about", label: "About" },
];

export function Navbar({ layout }: { layout: ThemeLayout }) {
  return <NavbarClient navItems={navItems} layout={layout} />;
}
