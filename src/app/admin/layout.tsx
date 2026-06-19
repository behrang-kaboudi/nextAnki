import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { getDashboardMenu } from "@/menus";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const dashboardMenu = await getDashboardMenu();

  return (
    <SessionProvider>
      <AppShell menu={dashboardMenu}>{children}</AppShell>
    </SessionProvider>
  );
}
