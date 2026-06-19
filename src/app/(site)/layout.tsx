import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { getSiteMenu } from "@/menus";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const siteMenu = await getSiteMenu();

  return (
    <SessionProvider>
      <AppShell menu={siteMenu}>{children}</AppShell>
    </SessionProvider>
  );
}
