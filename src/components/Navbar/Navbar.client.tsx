"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { NavbarView, type NavbarItem } from "./NavbarView";
import type { ThemeLayout } from "@/lib/theme/defaultThemes";

type NavbarClientProps = {
  navItems: NavbarItem[];
  layout: ThemeLayout;
};

export function NavbarClient({ navItems, layout }: NavbarClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const openMobileMenu = useCallback(() => setIsMobileMenuOpen(true), []);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const toggleMobileMenu = useCallback(
    () => setIsMobileMenuOpen((open) => !open),
    [],
  );

  useEffect(() => {
    document.querySelectorAll("nav details[open]").forEach((details) => {
      (details as HTMLDetailsElement).open = false;
    });
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const nav = target.closest("nav");
      if (nav) return;
      document.querySelectorAll("nav details[open]").forEach((details) => {
        (details as HTMLDetailsElement).open = false;
      });
    };
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true } as AddEventListenerOptions);
  }, []);

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
