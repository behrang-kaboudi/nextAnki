import Link from "next/link";

import { navbarStyles } from "./styles";
import type { ThemeLayout } from "@/lib/theme/defaultThemes";

export type NavbarItem = {
  href: string;
  label: string;
};

type NavbarViewProps = {
  navItems: NavbarItem[];
  layout: ThemeLayout;
  isMobileMenuOpen: boolean;
  onMobileMenuOpen: () => void;
  onMobileMenuClose: () => void;
  onMobileMenuToggle: () => void;
};

export function NavbarView({
  navItems,
  layout,
  isMobileMenuOpen,
  onMobileMenuClose,
  onMobileMenuToggle,
}: NavbarViewProps) {
  if (layout === "sidebar") {
    return (
      <>
        <header className={navbarStyles.mobileHeader}>
          <Link href="/" className={navbarStyles.mobileBrand}>
            <span className={navbarStyles.brandMark} aria-hidden>
              A
            </span>
            <span className={navbarStyles.brandText}>Anki Bridge</span>
          </Link>

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
        </header>

        <aside className={navbarStyles.sidebar}>
          <div className={navbarStyles.sidebarInner}>
            <Link href="/" className={navbarStyles.brandLink}>
              <span className={navbarStyles.brandMark} aria-hidden>
                A
              </span>
              <div className="grid leading-tight">
                <span className={navbarStyles.brandText}>Anki Bridge</span>
                <span className={navbarStyles.brandSubtext}>Study companion</span>
              </div>
            </Link>

            <nav className={navbarStyles.nav}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navbarStyles.navLink}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className={navbarStyles.sidebarFooter}>
              <Link href="/connect" className={navbarStyles.primaryAction}>
                Connect Anki
              </Link>
              <div className={navbarStyles.sidebarHint}>
                Runs locally against AnkiConnect
              </div>
            </div>
          </div>
        </aside>

        {isMobileMenuOpen ? (
          <div
            className={navbarStyles.mobileMenuOverlay}
            onClick={onMobileMenuClose}
          >
            <div
              className={navbarStyles.mobileMenuPanel}
              onClick={(event) => event.stopPropagation()}
            >
              <nav className={navbarStyles.mobileMenuNav}>
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileMenuClose}
                    className={navbarStyles.mobileMenuLink}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/connect"
                  onClick={onMobileMenuClose}
                  className={navbarStyles.mobileMenuPrimaryAction}
                >
                  Connect Anki
                </Link>
              </nav>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (layout === "focus") {
    return (
      <>
        <header className={navbarStyles.topbarHeader}>
          <div className={navbarStyles.topbarContainer}>
            <Link href="/" className={navbarStyles.topbarBrand}>
              <span className={navbarStyles.brandMark} aria-hidden>
                A
              </span>
              <span className={navbarStyles.brandText}>Anki Bridge</span>
            </Link>

            <nav className={navbarStyles.topbarNav}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navbarStyles.topbarLink}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              onClick={onMobileMenuToggle}
              className={navbarStyles.topbarMobileButton}
            >
              <span aria-hidden className={navbarStyles.mobileMenuIcon}>
                {isMobileMenuOpen ? "×" : "☰"}
              </span>
            </button>

            <div className={navbarStyles.topbarActions}>
              <Link href="/connect" className={navbarStyles.primaryAction}>
                Connect
              </Link>
            </div>
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
              <nav className={navbarStyles.mobileMenuNav}>
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileMenuClose}
                    className={navbarStyles.mobileMenuLink}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/connect"
                  onClick={onMobileMenuClose}
                  className={navbarStyles.mobileMenuPrimaryAction}
                >
                  Connect
                </Link>
              </nav>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <header className={navbarStyles.topbarHeader}>
        <div className={navbarStyles.topbarContainer}>
          <Link href="/" className={navbarStyles.topbarBrand}>
            <span className={navbarStyles.brandMark} aria-hidden>
              A
            </span>
            <span className={navbarStyles.brandText}>Anki Bridge</span>
          </Link>

          <nav className={navbarStyles.topbarNav}>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={navbarStyles.topbarLink}>
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={onMobileMenuToggle}
            className={navbarStyles.topbarMobileButton}
          >
            <span aria-hidden className={navbarStyles.mobileMenuIcon}>
              {isMobileMenuOpen ? "×" : "☰"}
            </span>
          </button>

          <div className={navbarStyles.topbarActions}>
            <Link href="/connect" className={navbarStyles.primaryAction}>
              Connect
            </Link>
          </div>
        </div>
      </header>

      {isMobileMenuOpen ? (
        <div className={navbarStyles.mobileMenuOverlay} onClick={onMobileMenuClose}>
          <div
            className={navbarStyles.mobileMenuPanel}
            onClick={(event) => event.stopPropagation()}
          >
            <nav className={navbarStyles.mobileMenuNav}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileMenuClose}
                  className={navbarStyles.mobileMenuLink}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/connect"
                onClick={onMobileMenuClose}
                className={navbarStyles.mobileMenuPrimaryAction}
              >
                Connect
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
