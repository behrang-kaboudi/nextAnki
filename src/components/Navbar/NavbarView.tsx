import Link from "next/link";

import { navbarStyles } from "./styles";
import type { ThemeLayout } from "@/lib/theme/defaultThemes";
import { MenuIcon } from "@/components/icons";
import { NavAuthWidget } from "@/components/auth/NavAuthWidget";

export type NavbarItem = {
  label: string;
  href?: string;
  children?: NavbarItem[];
  icon?: Parameters<typeof MenuIcon>[0]["name"];
  description?: string;
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

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function NavItemLink({
  item,
  className,
  iconClassName,
  onClick,
}: {
  item: NavbarItem;
  className: string;
  iconClassName: string;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const href = item.href ?? "#";
  const content = (
    <span className="flex items-center gap-2">
      {item.icon ? <MenuIcon name={item.icon} className={iconClassName} /> : null}
      <span>{item.label}</span>
    </span>
  );

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        title={item.description ?? item.label}
        onClick={onClick}
        className={className}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      title={item.description ?? item.label}
      onClick={onClick}
      className={className}
    >
      {content}
    </Link>
  );
}

function SidebarNavItems({
  items,
  onNavigate,
  parentKey = "sidebar",
}: {
  items: NavbarItem[];
  onNavigate?: () => void;
  parentKey?: string;
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
      {items.map((item, index) => {
        const itemKey = `${parentKey}-${index}-${item.href ?? item.label}`;

        if (item.children?.length) {
          return (
            <details key={itemKey} className={navbarStyles.navGroup}>
              <summary className={navbarStyles.navGroupSummary} onClick={closeSiblingDetails}>
                <span className="flex items-center gap-2">
                  {item.icon ? <MenuIcon name={item.icon} className="size-5 opacity-80" /> : null}
                  <span>{item.label}</span>
                </span>
                <ChevronDownIcon className={navbarStyles.navGroupChevron} />
              </summary>
              <div className={navbarStyles.subnav}>
                <SidebarNavItems items={item.children} onNavigate={onNavigate} parentKey={itemKey} />
              </div>
            </details>
          );
        }

        return (
          <NavItemLink
            key={itemKey}
            item={item}
            onClick={(event) => {
              closeAllDetailsInNav(event);
              onNavigate?.();
            }}
            className={navbarStyles.navLink}
            iconClassName="size-5 opacity-80"
          />
        );
      })}
    </>
  );
}

function TopbarNavItems({
  items,
  onNavigate,
  parentKey = "topbar",
}: {
  items: NavbarItem[];
  onNavigate?: () => void;
  parentKey?: string;
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
      {items.map((item, index) => {
        const itemKey = `${parentKey}-${index}-${item.href ?? item.label}`;

        if (item.children?.length) {
          return (
            <details key={itemKey} className={navbarStyles.topbarGroup}>
              <summary className={navbarStyles.topbarGroupSummary} onClick={closeSiblingDetails}>
                <span className="flex items-center gap-2">
                  {item.icon ? <MenuIcon name={item.icon} className="size-5 opacity-80" /> : null}
                  <span>{item.label}</span>
                </span>
                <ChevronDownIcon className={navbarStyles.navGroupChevron} />
              </summary>
              <div className={navbarStyles.topbarDropdown}>
                <TopbarNavItems items={item.children} onNavigate={onNavigate} parentKey={itemKey} />
              </div>
            </details>
          );
        }

        return (
          <NavItemLink
            key={itemKey}
            item={item}
            onClick={(event) => {
              closeAllDetailsInNav(event);
              onNavigate?.();
            }}
            className={navbarStyles.topbarLink}
            iconClassName="size-5 opacity-80"
          />
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
              <NavAuthWidget variant="primary" />
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
                <NavAuthWidget variant="mobile" onNavigate={onMobileMenuClose} />
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
              <NavAuthWidget variant="primary" />
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
                <NavAuthWidget variant="mobile" onNavigate={onMobileMenuClose} />
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
            <NavAuthWidget variant="primary" />
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
              <NavAuthWidget variant="mobile" onNavigate={onMobileMenuClose} />
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
