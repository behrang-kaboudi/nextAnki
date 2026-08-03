import { MenuManagerClient } from "./MenuManagerClient";
import { readEditableMenus } from "@/lib/menus/menuRepository";
import { menuIconNames } from "@/menus/types";
import { promises as fs } from "node:fs";
import path from "node:path";

export const metadata = {
  title: "Navigation Manager",
};

async function listPageRoutes() {
  const appDir = path.join(process.cwd(), "src", "app");
  const routes: string[] = [];

  async function walk(dir: string, segments: string[]) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith("(") && entry.name.endsWith(")")) {
          await walk(absolute, segments);
        } else {
          await walk(absolute, [...segments, entry.name]);
        }
      } else if (entry.isFile() && entry.name === "page.tsx") {
        const routeSegments = segments.map((segment) =>
          segment.startsWith("[") && segment.endsWith("]") ? `:${segment.slice(1, -1)}` : segment,
        );
        routes.push(`/${routeSegments.join("/")}`.replace(/\/$/, "") || "/");
      }
    }
  }

  await walk(appDir, []);
  return Array.from(new Set(routes)).sort((a, b) => a.localeCompare(b));
}

export default async function MenuManagerPage() {
  const [menus, siteRoutes] = await Promise.all([readEditableMenus(), listPageRoutes()]);
  return <MenuManagerClient initialMenus={menus} iconNames={[...menuIconNames]} siteRoutes={siteRoutes} />;
}
