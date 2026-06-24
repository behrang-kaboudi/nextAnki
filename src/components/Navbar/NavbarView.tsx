import Link from "next/link";

import { navbarStyles } from "./styles";
import { SidebarNavItems } from "./SidebarNavItems";
import { TopbarNavItems } from "./TopbarNavItems";
import type { NavbarItem } from "./types";
import { NavAuthWidget } from "@/components/auth/NavAuthWidget";

type NavbarViewProps = {
  navItems: NavbarItem[];
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
  onMobileMenuToggle: () => void;
};

export function NavbarView({
  navItems,
  isMobileMenuOpen,
  onMobileMenuClose,
  onMobileMenuToggle,
}: NavbarViewProps) {
  return (
    <>
      <header className={navbarStyles.header}>
        <div className={navbarStyles.headerInner}>
          <Link href="/" className={navbarStyles.brandLink}>
            <span className={navbarStyles.brandMark} aria-hidden>
              A
            </span>
            <span className={navbarStyles.brandText}>Anki Bridge</span>
          </Link>

          <nav className={navbarStyles.topbarNav}>
            <TopbarNavItems items={navItems} />
          </nav>

          <div className={navbarStyles.topbarActions}>
            <NavAuthWidget variant="primary" />
          </div>

          <button
            type="button"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={onMobileMenuToggle}
            className={navbarStyles.mobileMenuButton}
          >
            <span aria-hidden className={navbarStyles.mobileMenuIcon}>
              {isMobileMenuOpen ? "×" : "☰"}
            </span>
          </button>
        </div>
      </header>

      {isMobileMenuOpen ? (
        <div
          className={navbarStyles.mobileMenuOverlay}
          onClick={onMobileMenuClose}
        >
          <div
            className={navbarStyles.mobileMenuPanel}
            onClick={(event) => event.stopPropagation()}
          >
            <Link href="/" className={navbarStyles.mobileBrand} onClick={onMobileMenuClose}>
              <span className={navbarStyles.brandMark} aria-hidden>
                A
              </span>
              <span className={navbarStyles.brandText}>Anki Bridge</span>
            </Link>
            <nav className={navbarStyles.mobileMenuNav}>
              <SidebarNavItems items={navItems} onNavigate={onMobileMenuClose} />
              <NavAuthWidget variant="mobile" onNavigate={onMobileMenuClose} />
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
