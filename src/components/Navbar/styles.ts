export const navbarStyles = {
  header:
    "sticky top-0 z-40 border-b border-card bg-card/85 text-foreground backdrop-blur-xl",
  headerInner:
    "mx-auto flex h-12 w-full items-center gap-5 px-4 sm:px-8 lg:px-12",
  mobileBrand: "inline-flex items-center gap-3",
  brandLink:
    "inline-flex shrink-0 items-center gap-2 text-foreground transition hover:text-muted",
  brandMark:
    "grid size-6 place-items-center rounded-md bg-foreground text-xs font-semibold text-background",
  brandText: "text-sm font-medium tracking-tight text-inherit",
  topbarNav:
    "hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-visible lg:flex",
  topbarLink:
    "inline-flex h-12 items-center whitespace-nowrap px-3 text-xs font-medium text-muted transition hover:text-foreground",
  topbarGroup: "group relative",
  topbarGroupSummary:
    "flex h-12 cursor-pointer list-none items-center gap-1 whitespace-nowrap px-3 text-xs font-medium text-muted transition hover:text-foreground [&::-webkit-details-marker]:hidden",
  topbarChevron: "size-3 opacity-60 transition group-open:rotate-180",
  topbarDropdown:
    "absolute left-1/2 top-full z-50 grid min-w-56 -translate-x-1/2 gap-1 border border-card bg-card/95 p-3 shadow-elevated backdrop-blur-xl",
  dropdownLink:
    "flex min-h-10 items-center rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-background hover:text-foreground",
  dropdownGroup: "group/dropdown grid gap-1 rounded-md",
  dropdownGroupSummary:
    "flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-background hover:text-foreground [&::-webkit-details-marker]:hidden",
  dropdownSubnav: "grid gap-1 border-l border-card pl-3",
  topbarActions: "ml-auto hidden shrink-0 items-center gap-2 lg:flex",
  nav: "grid gap-1",
  navLink:
    "rounded-md px-3 py-2.5 text-base font-medium text-muted transition hover:bg-background hover:text-foreground active:scale-[0.99]",
  navGroup: "group grid gap-1 rounded-md",
  navGroupSummary:
    "flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2.5 text-base font-medium text-muted transition hover:bg-background hover:text-foreground [&::-webkit-details-marker]:hidden",
  navGroupChevron:
    "size-5 opacity-70 transition duration-200 group-open:rotate-180",
  subnav: "grid gap-1 pl-3",
  subnavLink:
    "rounded-md px-3 py-2 text-[0.95rem] text-muted transition hover:bg-background hover:text-foreground",
  primaryAction:
    "inline-flex items-center justify-center rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90",
  mobileMenuButton:
    "ml-auto inline-flex items-center justify-center rounded-md px-3 py-2 text-foreground transition hover:bg-background lg:hidden",
  mobileMenuIcon: "text-xl leading-none",
  mobileMenuOverlay:
    "fixed inset-0 z-50 bg-black/25 backdrop-blur-sm lg:hidden",
  mobileMenuPanel:
    "absolute right-3 top-3 grid max-h-[calc(100dvh-1.5rem)] w-[min(92vw,24rem)] gap-4 overflow-auto border border-card bg-card p-4 shadow-elevated",
  mobileMenuNav: "grid gap-1",
  mobileMenuLink:
    "rounded-md px-3 py-3 text-base font-medium text-foreground transition hover:bg-background active:scale-[0.99]",
  mobileMenuPrimaryAction:
    "mt-2 rounded-md bg-[var(--primary)] px-3 py-3 text-center text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90",
} as const;
