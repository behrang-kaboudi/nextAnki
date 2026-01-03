import { NavbarClient } from "./Navbar.client";
import type { NavbarItem } from "./NavbarView";
import type { ThemeLayout } from "@/lib/theme/defaultThemes";

const navItems: NavbarItem[] = [
  {
    label: "App",
    children: [
      { href: "/features", label: "features" },
      { href: "/connect", label: "connect" },
      { href: "/docs", label: "docs" },
    ],
  },
  { href: "/word-extraction", label: "Word Extraction" },
  {
    label: "IPA",
    children: [
      { href: "/ipa-test", label: "ipa-test" },
      { href: "/ipa/keywords", label: "ipa-keywords" },
      { href: "/ipa/picture-words", label: "picture-words" },
      { href: "/ipa/phrase-building", label: "phrase-building" },
    ],
  },
  {
    label: "Anki",
    children: [
      { href: "/anki-note", label: "anki-note" },
      { href: "/anki-deck", label: "anki-deck" },
    ],
  },
  {
    label: "Admin",
    children: [
      { href: "/admin/themes", label: "themes" },
      { href: "/admin/data", label: "data" },
    ],
  },
  { href: "/about", label: "About" },
];

export function Navbar({ layout }: { layout: ThemeLayout }) {
  return <NavbarClient navItems={navItems} layout={layout} />;
}
