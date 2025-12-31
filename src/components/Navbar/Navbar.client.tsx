"use client";

import { useCallback, useState } from "react";

import { NavbarView, type NavbarItem } from "./NavbarView";
import type { ThemeLayout } from "@/lib/theme/defaultThemes";

type NavbarClientProps = {
  navItems: NavbarItem[];
  layout: ThemeLayout;
};

export function NavbarClient({ navItems, layout }: NavbarClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const openMobileMenu = useCallback(() => setIsMobileMenuOpen(true), []);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const toggleMobileMenu = useCallback(
    () => setIsMobileMenuOpen((open) => !open),
    [],
  );

  return (
    <NavbarView
      navItems={navItems}
      layout={layout}
      isMobileMenuOpen={isMobileMenuOpen}
      onMobileMenuOpen={openMobileMenu}
      onMobileMenuClose={closeMobileMenu}
      onMobileMenuToggle={toggleMobileMenu}
    />
  );
}
