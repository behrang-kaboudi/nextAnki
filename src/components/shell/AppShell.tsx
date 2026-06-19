import type { ReactNode } from "react";

import { Footer } from "@/components/footer";
import { Navbar } from "@/components/Navbar";
import type { Menu } from "@/menus";

export function AppShell({
  children,
  menu,
}: {
  children: ReactNode;
  menu: Menu;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <Navbar items={menu.primary} />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">{children}</main>
      <Footer />
    </div>
  );
}
