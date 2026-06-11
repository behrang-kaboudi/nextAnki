import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { getSiteMenu } from "@/menus";
import { defaultThemes } from "@/lib/theme/defaultThemes";
import { getActiveTheme } from "@/lib/theme/themeRepository";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const activeTheme = (await getActiveTheme()) ?? {
    slug: defaultThemes[0].slug,
    variables: defaultThemes[0].variables,
  };
  const siteMenu = await getSiteMenu();

  return (
    <SessionProvider>
      <AppShell layout={activeTheme.variables.layout} menu={siteMenu}>
        {children}
      </AppShell>
    </SessionProvider>
  );
}
