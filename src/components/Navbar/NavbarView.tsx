import Link from "next/link";

import { navbarStyles } from "./styles";
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
  isMobileMenuOpen: boolean;
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
  parentKey = "topbar",
}: {
  items: NavbarItem[];
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
                <span>{item.label}</span>
                <ChevronDownIcon className={navbarStyles.topbarChevron} />
              </summary>
              <div className={navbarStyles.topbarDropdown}>
                <DropdownNavItems items={item.children} parentKey={itemKey} />
              </div>
            </details>
          );
        }

        return (
          <NavItemLink
            key={itemKey}
            item={item}
            onClick={closeAllDetailsInNav}
            className={navbarStyles.topbarLink}
            iconClassName="hidden"
          />
        );
      })}
    </>
  );
}

function DropdownNavItems({
  items,
  parentKey = "dropdown",
}: {
  items: NavbarItem[];
  parentKey?: string;
}) {
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
            <details key={itemKey} className={navbarStyles.dropdownGroup}>
              <summary className={navbarStyles.dropdownGroupSummary}>
                <span className="flex items-center gap-2">
                  {item.icon ? <MenuIcon name={item.icon} className="size-4 opacity-70" /> : null}
                  <span>{item.label}</span>
                </span>
                <ChevronDownIcon className={navbarStyles.navGroupChevron} />
              </summary>
              <div className={navbarStyles.dropdownSubnav}>
                <DropdownNavItems items={item.children} parentKey={itemKey} />
              </div>
            </details>
          );
        }

        return (
          <NavItemLink
            key={itemKey}
            item={item}
            onClick={closeAllDetailsInNav}
            className={navbarStyles.dropdownLink}
            iconClassName="size-4 opacity-70"
          />
        );
      })}
    </>
  );
}

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
