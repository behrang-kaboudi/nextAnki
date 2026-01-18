import type { ReactNode } from "react";

import { Footer } from "@/components/footer";
import { Navbar } from "@/components/Navbar";
import type { Menu } from "@/menus";
import type { ThemeLayout } from "@/lib/theme/defaultThemes";

export function AppShell({
  children,
  layout,
  menu,
}: {
  children: ReactNode;
  layout: ThemeLayout;
  menu: Menu;
}) {
  if (layout === "sidebar") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-2xl">
        <Navbar layout={layout} items={menu.primary} />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1 px-4 py-10 sm:px-8">{children}</main>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Navbar layout={layout} items={menu.primary} />
      <main className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}

