export const navbarStyles = {
  mobileHeader:
    "sticky top-0 z-40 flex items-center justify-between border-b border-card bg-background/80 px-4 py-3 backdrop-blur sm:hidden",
  mobileBrand: "inline-flex items-center gap-3",
  sidebar:
    "hidden w-72 flex-none border-r border-card bg-card sm:block",
  sidebarInner: "flex h-full flex-col gap-6 px-4 py-6",
  brandLink:
    "group inline-flex items-center gap-3 rounded-2xl border border-card bg-background px-3 py-3 shadow-elevated",
  brandMark:
    "grid size-10 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--primary),#9333ea)] text-sm font-semibold text-white",
  brandText: "text-sm font-semibold tracking-tight text-foreground",
  brandSubtext: "text-xs text-muted",
  nav: "grid gap-1",
  navLink:
    "rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-background hover:text-foreground",
  sidebarFooter: "mt-auto grid gap-3",
  sidebarHint: "text-xs text-muted",
  primaryAction:
    "inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95",
  topbarHeader:
    "sticky top-0 z-40 border-b border-card bg-background/80 backdrop-blur",
  topbarContainer:
    "mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-8",
  topbarBrand: "inline-flex items-center gap-3",
  topbarNav: "hidden flex-1 items-center gap-1 sm:flex",
  topbarLink:
    "rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-card hover:text-foreground",
  topbarActions: "hidden sm:flex items-center gap-2",
  topbarMobileButton:
    "ml-auto inline-flex items-center justify-center rounded-xl border border-card bg-card px-3 py-2 text-foreground transition hover:bg-background sm:hidden",
  mobileMenuButton:
    "inline-flex items-center justify-center rounded-xl border border-card bg-card px-3 py-2 text-foreground transition hover:bg-background sm:hidden",
  mobileMenuIcon: "text-lg leading-none",
  mobileMenuOverlay:
    "sm:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm",
  mobileMenuPanel:
    "absolute right-4 top-4 w-[min(92vw,22rem)] rounded-2xl border border-card bg-card p-3 shadow-elevated",
  mobileMenuNav: "flex flex-col gap-1",
  mobileMenuLink:
    "rounded-xl px-3 py-3 text-sm text-foreground transition hover:bg-background",
  mobileMenuPrimaryAction:
    "mt-2 rounded-xl bg-[var(--primary)] px-3 py-3 text-center text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-95",
} as const;
