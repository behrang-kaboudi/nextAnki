import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";

import {
  menuIconNames,
  type EditableMenus,
  type Menu,
  type MenuIcon,
  type MenuItem,
} from "@/menus/types";

export const MENU_CONFIG_PATH = path.join(process.cwd(), "config", "menus.json");
export const MAX_MENU_DEPTH = 3;

const allowedMenuIds = new Set(["marketing", "app", "dashboard"]);
const allowedIcons = new Set<string>(menuIconNames);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalIcon(value: unknown, pathLabel: string): MenuIcon | undefined {
  const icon = cleanString(value);
  if (!icon) return undefined;
  if (!allowedIcons.has(icon)) {
    throw new Error(`${pathLabel}: invalid icon "${icon}".`);
  }
  return icon as MenuIcon;
}

function validateHref(value: unknown, pathLabel: string): string {
  const href = cleanString(value);
  if (!href) throw new Error(`${pathLabel}: href is required.`);
  if (href.startsWith("/")) return href;
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") return href;
  } catch {
    // handled below
  }
  throw new Error(`${pathLabel}: href must start with "/" or be an http(s) URL.`);
}

function validateItems(value: unknown, pathLabel: string, depth: number): MenuItem[] {
  if (!Array.isArray(value)) throw new Error(`${pathLabel}: items must be an array.`);
  return value.map((item, index) => validateItem(item, `${pathLabel}[${index}]`, depth));
}

function validateItem(value: unknown, pathLabel: string, depth: number): MenuItem {
  if (!isRecord(value)) throw new Error(`${pathLabel}: menu item must be an object.`);

  const type = value.type;
  const label = cleanString(value.label);
  if (!label) throw new Error(`${pathLabel}: label is required.`);

  const icon = optionalIcon(value.icon, pathLabel);

  if (type === "link") {
    const href = validateHref(value.href, pathLabel);
    const description = cleanString(value.description);
    return {
      type: "link",
      label,
      href,
      ...(icon ? { icon } : {}),
      ...(description ? { description } : {}),
    };
  }

  if (type === "group") {
    if (depth >= MAX_MENU_DEPTH) {
      throw new Error(`${pathLabel}: groups can only be nested ${MAX_MENU_DEPTH} levels deep.`);
    }
    const items = validateItems(value.items, `${pathLabel}.items`, depth + 1);
    return {
      type: "group",
      label,
      items,
      ...(icon ? { icon } : {}),
    };
  }

  throw new Error(`${pathLabel}: type must be "link" or "group".`);
}

function validateMenu(value: unknown, pathLabel: string): Menu {
  if (!isRecord(value)) throw new Error(`${pathLabel}: menu must be an object.`);

  const id = cleanString(value.id);
  if (!allowedMenuIds.has(id)) throw new Error(`${pathLabel}: invalid menu id "${id}".`);

  return {
    id: id as Menu["id"],
    primary: validateItems(value.primary, `${pathLabel}.primary`, 1),
  };
}

export function validateEditableMenus(value: unknown): EditableMenus {
  if (!isRecord(value)) throw new Error("Menu config must be an object.");
  return {
    site: validateMenu(value.site, "site"),
    dashboard: validateMenu(value.dashboard, "dashboard"),
  };
}

export async function readEditableMenus(): Promise<EditableMenus> {
  noStore();
  const raw = await fs.readFile(MENU_CONFIG_PATH, "utf8");
  return validateEditableMenus(JSON.parse(raw) as unknown);
}

export async function writeEditableMenus(menus: EditableMenus): Promise<EditableMenus> {
  const cleanMenus = validateEditableMenus(menus);
  await fs.mkdir(path.dirname(MENU_CONFIG_PATH), { recursive: true });
  await fs.writeFile(MENU_CONFIG_PATH, `${JSON.stringify(cleanMenus, null, 2)}\n`, "utf8");
  return cleanMenus;
}
