import Link from "next/link";

import { navbarStyles } from "./styles";
import type { ThemeLayout } from "@/lib/theme/defaultThemes";

export type NavbarItem = {
  label: string;
  href?: string;
  children?: NavbarItem[];
};

type NavbarViewProps = {
  navItems: NavbarItem[];
  layout: ThemeLayout;
  isMobileMenuOpen: boolean;
  onMobileMenuOpen: () => void;
  onMobileMenuClose: () => void;
  onMobileMenuToggle: () => void;
};

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M5.22 7.97a.75.75 0 0 1 1.06 0L10 11.69l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.03a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SidebarNavItems({
  items,
  onNavigate,
}: {
  items: NavbarItem[];
  onNavigate?: () => void;
}) {
  const closeSiblingDetails = (event: React.MouseEvent<HTMLElement>) => {
    const nav = (event.currentTarget as HTMLElement).closest("nav");
    if (!nav) return;
    const currentDetails = (event.currentTarget as HTMLElement).closest("details");
    nav.querySelectorAll("details[open]").forEach((details) => {
      if (currentDetails && details === currentDetails) return;
      (details as HTMLDetailsElement).open = false;
    });
  };

  const closeAllDetailsInNav = (event: React.MouseEvent<HTMLElement>) => {
    const nav = (event.currentTarget as HTMLElement).closest("nav");
    if (!nav) return;

    nav.querySelectorAll("details[open]").forEach((details) => {
      (details as HTMLDetailsElement).open = false;
    });
  };

  return (
    <>
      {items.map((item) => {
        if (item.children?.length) {
          return (
            <details key={item.label} className={navbarStyles.navGroup}>
              <summary className={navbarStyles.navGroupSummary} onClick={closeSiblingDetails}>
                <span>{item.label}</span>
                <ChevronDownIcon className={navbarStyles.navGroupChevron} />
              </summary>
              <div className={navbarStyles.subnav}>
                {item.children.map((child) => (
                  <Link
                    key={child.href ?? child.label}
                    href={child.href ?? "#"}
                    onClick={(event) => {
                      closeAllDetailsInNav(event);
                      onNavigate?.();
                    }}
                    className={navbarStyles.subnavLink}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </details>
          );
        }

        return (
          <Link
            key={item.href ?? item.label}
            href={item.href ?? "#"}
            onClick={(event) => {
              closeAllDetailsInNav(event);
              onNavigate?.();
            }}
            className={navbarStyles.navLink}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function TopbarNavItems({
  items,
  onNavigate,
}: {
  items: NavbarItem[];
  onNavigate?: () => void;
}) {
  const closeSiblingDetails = (event: React.MouseEvent<HTMLElement>) => {
    const nav = (event.currentTarget as HTMLElement).closest("nav");
    if (!nav) return;
    const currentDetails = (event.currentTarget as HTMLElement).closest("details");
    nav.querySelectorAll("details[open]").forEach((details) => {
      if (currentDetails && details === currentDetails) return;
      (details as HTMLDetailsElement).open = false;
    });
  };

  const closeAllDetailsInNav = (event: React.MouseEvent<HTMLElement>) => {
    const nav = (event.currentTarget as HTMLElement).closest("nav");
    if (!nav) return;

    nav.querySelectorAll("details[open]").forEach((details) => {
      (details as HTMLDetailsElement).open = false;
    });
  };

  return (
    <>
      {items.map((item) => {
        if (item.children?.length) {
          return (
            <details key={item.label} className={navbarStyles.topbarGroup}>
              <summary className={navbarStyles.topbarGroupSummary} onClick={closeSiblingDetails}>
                <span>{item.label}</span>
                <ChevronDownIcon className={navbarStyles.navGroupChevron} />
              </summary>
              <div className={navbarStyles.topbarDropdown}>
                {item.children.map((child) => (
                  <Link
                    key={child.href ?? child.label}
                    href={child.href ?? "#"}
                    onClick={(event) => {
                      closeAllDetailsInNav(event);
                      onNavigate?.();
                    }}
                    className={navbarStyles.topbarDropdownLink}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </details>
          );
        }

        return (
          <Link
            key={item.href ?? item.label}
            href={item.href ?? "#"}
            onClick={(event) => {
              closeAllDetailsInNav(event);
              onNavigate?.();
            }}
            className={navbarStyles.topbarLink}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

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
              <SidebarNavItems items={navItems} />
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
                <SidebarNavItems items={navItems} onNavigate={onMobileMenuClose} />
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
              <TopbarNavItems items={navItems} />
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
                <SidebarNavItems items={navItems} onNavigate={onMobileMenuClose} />
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
            <TopbarNavItems items={navItems} />
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
              <SidebarNavItems items={navItems} onNavigate={onMobileMenuClose} />
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
