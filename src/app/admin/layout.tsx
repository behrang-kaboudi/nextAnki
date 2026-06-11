import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { getDashboardMenu } from "@/menus";
import { defaultThemes } from "@/lib/theme/defaultThemes";
import { getActiveTheme } from "@/lib/theme/themeRepository";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const activeTheme = (await getActiveTheme()) ?? {
    slug: defaultThemes[0].slug,
    variables: defaultThemes[0].variables,
  };
  const dashboardMenu = await getDashboardMenu();

  return (
    <SessionProvider>
      <AppShell layout={activeTheme.variables.layout} menu={dashboardMenu}>
        {children}
      </AppShell>
    </SessionProvider>
  );
}
